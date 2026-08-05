# Download source report

Generated: 2026-08-05

## Sources used

### Tobacco leaves dataset (Virginia flue-cured, Tanzania)

- Repository: Harvard Dataverse
- Landing page: https://doi.org/10.7910/DVN/TTPLFT
- DOI: `doi:10.7910/DVN/TTPLFT`
- License: CC0 1.0 Universal (public domain dedication)
- Companion paper: https://doi.org/10.1016/j.dib.2024.110838
- Cured / dried leaves: yes
- Notes: Cured (flue-cured) leaves photographed on grading tables at 90 degrees under white-tent diffused light with a Canon 5D Mark III + 100 mm macro lens. 49,778 JPEGs at 960x1440, one leaf per image.

**Required attribution**

> Nguleni, Faith (2024), 'Tobacco leaves dataset', Harvard Dataverse, V1, doi:10.7910/DVN/TTPLFT. Collected by NM-AIST, the Tobacco Research Institute of Tanzania (TORITA) and the Tanzania Tobacco Board (TTB).

## Sources searched and rejected

| Source | Why not used |
| --- | --- |
| Kaggle | No cured-tobacco grading set. Tobacco-800/Tobacco-3482 are scanned *documents*; the tobacco leaf sets present are disease or segmentation sets of green leaves. |
| Roboflow Universe | Tobacco projects are disease/object detection on green leaves; no public grading set. Site is behind Cloudflare, so programmatic collection would also breach its access terms. |
| GitHub | Grading repos ship code and weights, not images (KUST-IMG Tobacco-Leaf-Grading_CDD_2023, ChenDoubleD/FDANet). The one repo with images (shreyasnnn) labels leaf *maturity* in Chinese, not grade, and carries no license. |
| Zenodo | No tobacco leaf grading image dataset; hits are plant biology, tobacco-control policy and museum object scans. |
| Figshare | Only journal supplementary tables (spectra, agronomy, flavour chemistry). No leaf image sets. |
| Mendeley Data | No cured tobacco leaf grading image dataset indexed. |
| OpenAIRE | Aggregated search surfaced the Harvard Dataverse set used here as the only matching public dataset. |
| Chinese university / CNTC datasets | The two large flue-cured grading sets (21,113 images, 20 grades, Sci Rep 2023; hyperspectral sets) are explicitly not public - 'available from the corresponding author on reasonable request'. |
| ResearchGate | Hosts the papers, not the image data; bulk download would breach its terms of use. |
