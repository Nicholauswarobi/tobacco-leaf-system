"""Prediction endpoints.

Every route here follows the same pipeline:

    upload -> Tobacco Verification -> reject, or continue to disease/quality

Verification runs *before* the upload is written to disk, so a rejected image
never costs a file, a history row, or a downstream inference.

Every blocking step - Keras inference, the colour screens, the disk write, the
SQLite insert - is dispatched with `run_in_threadpool`. These handlers are
`async def` because they have to await the upload body, and anything blocking
called directly from one of them stalls the *entire* server for its duration:
on CPU that is a second or more per leaf, during which uvicorn cannot accept
the next upload, serve a result image, or answer a health check. The work is
the same, it simply no longer happens on the event loop.
"""
from fastapi import APIRouter, File, UploadFile, HTTPException, status, Query
from fastapi.concurrency import run_in_threadpool

from app.utils.image_utils import validate_and_load, save_upload
from app.services.prediction_service import (
    predict_disease_only,
    predict_quality_only,
    predict_full,
)
from app.services.verification_service import (
    verification_service,
    NotATobaccoLeafError,
    WrongSectionError,
)
from app.services.history_service import history_service
from app.schemas.prediction import (
    PredictionResponse,
    VerificationResponse,
    VerificationResult,
)

router = APIRouter()


def _to_verification_result(outcome) -> VerificationResult:
    return VerificationResult(
        is_tobacco=outcome.is_tobacco,
        label=outcome.label,
        confidence=outcome.confidence,
        message=outcome.message,
        method=outcome.method,
        threshold=outcome.threshold,
        all_probabilities=outcome.probabilities,
        detail=outcome.detail,
    )


@router.post(
    "/verify",
    response_model=VerificationResponse,
    summary="Check whether an image is a tobacco leaf",
    responses={422: {"description": "Not a tobacco leaf"}},
)
async def verify(file: UploadFile = File(...)) -> VerificationResponse:
    """Run the Tobacco Verification Model on its own.

    Useful for validating an image before committing to a full analysis, and
    for testing the gate in isolation. Returns 422 with the standard rejection
    body when the image is not a tobacco leaf.
    """
    image, _raw, _ext = await validate_and_load(file)

    # verify_or_raise, so a rejection produces the same 422 body here as it
    # does on the prediction routes.
    outcome = await run_in_threadpool(verification_service.verify_or_raise, image)

    return VerificationResponse(
        verification=_to_verification_result(outcome),
        processing_time_ms=outcome.processing_time_ms,
    )


@router.post(
    "/predict/disease",
    response_model=PredictionResponse,
    summary="Detect diseases in a tobacco leaf image",
    responses={422: {"description": "Not a tobacco leaf, so disease detection was not run"}},
)
async def predict_disease(file: UploadFile = File(...)) -> PredictionResponse:
    """Verify, then run disease detection, persist a history record, return JSON."""
    image, raw, ext = await validate_and_load(file)

    # Stage 1: nothing is written and no downstream model runs until this passes.
    outcome = await run_in_threadpool(verification_service.verify_or_raise, image)

    _, public_url = await run_in_threadpool(save_upload, raw, ext)

    try:
        result = await run_in_threadpool(
            predict_disease_only, image, public_url, outcome
        )
    except (NotATobaccoLeafError, WrongSectionError):
        raise  # handled globally: keeps one rejection shape across the API
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Disease prediction failed: {exc}",
        ) from exc

    await run_in_threadpool(history_service.save, result)
    return result


@router.post(
    "/predict/quality",
    response_model=PredictionResponse,
    summary="Grade the quality of a tobacco leaf image",
    responses={422: {"description": "Not a tobacco leaf, so quality grading was not run"}},
)
async def predict_quality(file: UploadFile = File(...)) -> PredictionResponse:
    """Verify, then run quality grading, persist a history record, return JSON."""
    image, raw, ext = await validate_and_load(file)

    outcome = await run_in_threadpool(verification_service.verify_or_raise, image)

    _, public_url = await run_in_threadpool(save_upload, raw, ext)

    try:
        result = await run_in_threadpool(
            predict_quality_only, image, public_url, outcome
        )
    except (NotATobaccoLeafError, WrongSectionError):
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Quality prediction failed: {exc}",
        ) from exc

    await run_in_threadpool(history_service.save, result)
    return result


@router.post(
    "/predict",
    response_model=PredictionResponse,
    summary="Predict both disease and quality grade in one call",
    responses={422: {"description": "Not a tobacco leaf, so no analysis was run"}},
)
async def predict(
    file: UploadFile = File(...),
    mode: str = Query("full", description="'full' (default), 'disease', or 'quality'"),
) -> PredictionResponse:
    """Run disease + quality prediction together. Use mode='disease' or mode='quality' to run only one."""
    image, raw, ext = await validate_and_load(file)

    outcome = await run_in_threadpool(verification_service.verify_or_raise, image)

    _, public_url = await run_in_threadpool(save_upload, raw, ext)

    if mode == "quality":
        run = predict_quality_only
    elif mode == "disease":
        run = predict_disease_only
    else:
        run = predict_full

    try:
        result = await run_in_threadpool(run, image, public_url, outcome)
    except (NotATobaccoLeafError, WrongSectionError):
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {exc}",
        ) from exc

    await run_in_threadpool(history_service.save, result)
    return result
