"use client";

/**
 * English / Swahili translation layer.
 *
 * The people who use this system in the field read Swahili, so every string
 * they can see is defined here in both languages rather than hard-coded in a
 * component. Keys are flat and dotted so a missing translation is obvious.
 *
 * The chosen language is remembered in localStorage. On the server we always
 * render English and swap after mount, which keeps the markup identical on
 * both sides of hydration.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type { Lang } from "@/types";

export type { Lang };

const STORAGE_KEY = "tobaccoscan-lang";

const EN = {
  // ── Navigation ──
  "nav.home": "Home",
  "nav.disease": "Disease Check",
  "nav.quality": "Quality Grade",
  "nav.dashboard": "Dashboard",
  "nav.history": "History",
  "nav.about": "About",
  "nav.start": "Start analysis",
  "nav.menu": "Menu",
  "nav.language": "Language",

  // ── Shared ──
  "common.loading": "Loading…",
  "common.retry": "Try again",
  "common.refresh": "Refresh",
  "common.back": "Back",
  "common.confidence": "Confidence",
  "common.newAnalysis": "New analysis",
  "common.noConnection": "Cannot reach the system right now.",
  "common.noConnectionHelp":
    "The system may be starting up, or your device may be offline. Wait a moment and try again.",

  // ── Home ──
  "home.badge": "Know your leaf before you sell it",
  "home.title1": "Read the leaf.",
  "home.title2": "Know the harvest.",
  "home.lead":
    "Take a photo of a tobacco leaf and TobaccoScan tells you whether it is sick, what to spray, and what grade it will fetch — in seconds, on your phone.",
  "home.ctaDisease": "Check for disease",
  "home.ctaQuality": "Check quality grade",
  "home.statDiseases": "Diseases",
  "home.statGrades": "Grades",
  "home.statSpeed": "Answer in",
  "home.feature1.title": "Find disease early",
  "home.feature1.body":
    "Spot leaf spot diseases while there is still time to treat them and save the crop.",
  "home.feature2.title": "Know your grade",
  "home.feature2.body":
    "See whether a cured leaf is Grade A, B or C before you carry it to the buyer.",
  "home.feature3.title": "Get the medicine",
  "home.feature3.body":
    "Every diagnosis comes with the medicine to use, how much to mix, and how often to spray.",
  "home.stepsEyebrow": "How to use it",
  "home.stepsTitle": "Three steps, start to finish.",
  "home.stepsTry": "Try it now",
  "home.step1.title": "Take a photo",
  "home.step1.body":
    "Photograph one leaf in daylight. Fill the picture with the leaf.",
  "home.step2.title": "Send it",
  "home.step2.body": "Upload the photo and wait about a second.",
  "home.step3.title": "Act on it",
  "home.step3.body": "Read what the leaf has and what to do about it.",
  "home.detectEyebrow": "What it looks for",
  "home.detectTitle": "Trained on real tobacco leaves.",
  "home.detectBody":
    "The system has studied thousands of tobacco leaves, healthy and sick, so it recognises the problems that damage this crop most often.",
  "home.ctaTitle": "Check your first leaf today.",
  "home.ctaBody":
    "Take one photo and get the diagnosis, the grade and the treatment straight away.",
  "home.ctaButton": "Check a leaf now",

  // ── Disease / quality pages ──
  "disease.eyebrow": "Disease check",
  "disease.title": "Is this leaf sick?",
  "disease.lead":
    "Photograph a fresh green leaf from the field in daylight. The system will tell you whether it is healthy or has a leaf spot disease, and what to spray.",
  "quality.eyebrow": "Quality grade",
  "quality.title": "What grade is this leaf?",
  "quality.lead":
    "Photograph a cured (dried) leaf in even daylight. The system will give it a grade of A, B or C so you know its value before you sell.",

  // ── Upload panel ──
  "upload.dropTitle": "Put a leaf photo here",
  "upload.dropBody":
    "JPG, PNG or WebP, up to 10 MB. Use daylight, fill the frame with one leaf, and photograph the top side.",
  "upload.choose": "Choose photo",
  "upload.camera": "Use camera",
  "upload.ready": "Ready to check",
  "upload.remove": "Remove photo",
  "upload.runTitle": "Check the leaf",
  "upload.runDisease":
    "The system will look for disease on this leaf and tell you what to do.",
  "upload.runQuality":
    "The system will grade this leaf and tell you what it is worth.",
  "upload.run": "Check now",
  "upload.running": "Checking the leaf…",
  "upload.speed": "Takes about one second",
  "upload.tooLarge": "That photo is too big ({size} MB). The limit is 10 MB.",
  "upload.failed": "The check did not finish. Please try again.",
  "upload.getDisease1": "What disease the leaf has, if any",
  "upload.getDisease2": "The medicine to use and how to mix it",
  "upload.getDisease3": "How sure the system is",
  "upload.getDisease4": "A copy saved in your history",
  "upload.getQuality1": "The grade: A, B or C",
  "upload.getQuality2": "What that grade is worth",
  "upload.getQuality3": "How sure the system is",
  "upload.getQuality4": "A copy saved in your history",
  "upload.wrongSectionTitle": "This is a tobacco leaf.",
  "upload.goTo": "Go to {section}",
  "upload.notLeafTip":
    "Tip: photograph one leaf only, in daylight, against a plain background.",
  "upload.tryAnother": "Try another photo",

  // ── Result ──
  "result.doneDisease": "Disease check finished",
  "result.doneQuality": "Grading finished",
  "result.doneFull": "Check finished",
  "result.healthy": "This leaf is healthy.",
  "result.detected": "This leaf has",
  "result.gradeIs": "This leaf is",
  "result.backTo": "Back to {section}",
  "result.uploadAnother": "Check another leaf",
  "result.share": "Share",
  "result.export": "Save as file",
  "result.diseaseSection": "Disease",
  "result.qualitySection": "Quality grade",
  "result.againTitle": "Check another leaf",
  "result.againBody": "Take the next photo in {section}, or change section.",
  "result.againButton": "Check another in {section}",
  "result.goOther": "Go to {section}",
  "result.noQualityModel":
    "Grading is not ready yet. Only the disease check is available for now.",
  "result.recommendations": "Advice",

  // ── Treatment block ──
  "tx.title": "What to do",
  "tx.medicine": "Medicine — choose one",
  "tx.treatNow": "Treat now",
  "tx.noTreatment": "No medicine needed",
  "tx.confirmFirst": "Check first",

  // ── Dashboard ──
  "dash.eyebrow": "Your records",
  "dash.title": "Summary",
  "dash.lead":
    "Everything you have checked so far, counted up. See which disease is most common and how your grades are spread.",
  "dash.total": "Leaves checked",
  "dash.healthy": "Healthy leaves",
  "dash.confidence": "Average certainty",
  "dash.diseased": "Sick leaves found",
  "dash.diseaseChart": "Diseases found",
  "dash.diseaseChartSub": "How many times each result appeared",
  "dash.gradeChart": "Grades given",
  "dash.gradeChartSub": "How your leaves were graded",
  "dash.recent": "Latest checks",
  "dash.viewAll": "See all",
  "dash.empty": "You have not checked any leaves yet.",
  "dash.emptyCta": "Check your first leaf",
  "dash.noData": "Nothing to show yet.",
  "dash.loadFailed": "Could not load your records.",

  // ── History ──
  "hist.eyebrow": "Your records",
  "hist.title": "Past checks",
  "hist.lead":
    "Every leaf you have checked is kept here. Search it, filter it, or save it all to a file.",
  "hist.export": "Save all to file",
  "hist.search": "Search by disease, grade or number…",
  "hist.all": "All",
  "hist.disease": "Disease",
  "hist.quality": "Quality",
  "hist.full": "Both",
  "hist.colLeaf": "Leaf",
  "hist.colType": "Check",
  "hist.colDisease": "Disease",
  "hist.colGrade": "Grade",
  "hist.colWhen": "When",
  "hist.colActions": "Remove",
  "hist.notRun": "Not checked",
  "hist.empty": "You have not checked any leaves yet.",
  "hist.emptySearch": "Nothing matches your search.",
  "hist.emptyCta": "Check your first leaf",
  "hist.loadFailed": "Could not load your past checks.",
  "hist.deleteConfirm": "Remove this check from your records?",
  "hist.deleteFailed": "Could not remove it. Please try again.",
  "hist.showing": "Showing {shown} of {total}",

  // ── About ──
  "about.eyebrow": "About",
  "about.title": "What TobaccoScan does",
  "about.lead":
    "TobaccoScan looks at a photo of a tobacco leaf and tells you two things: whether the leaf is sick, and what grade it deserves. It is made for farmers, not for laboratories.",
  "about.what1.title": "It finds disease",
  "about.what1.body":
    "Photograph a fresh green leaf from your field. The system tells you if it has a leaf spot disease, and names the medicine to spray, how much to mix with water, and how often.",
  "about.what2.title": "It grades quality",
  "about.what2.body":
    "Photograph a cured leaf. The system gives it Grade A, B or C, so you know what it is worth before you take it to the buyer.",
  "about.what3.title": "It keeps your records",
  "about.what3.body":
    "Every leaf you check is saved. You can look back at them any time, or save them all to a file to keep on your computer.",
  "about.howTitle": "How to get a good photo",
  "about.how1": "Use daylight. Do not use a flash.",
  "about.how2": "Photograph one leaf at a time.",
  "about.how3": "Fill the picture with the leaf.",
  "about.how4": "Put the leaf on a plain background.",
  "about.how5": "Photograph the top side of the leaf.",
  "about.sectionsTitle": "Which section to use",
  "about.sections1.title": "Fresh green leaf from the field",
  "about.sections1.body": "Use Disease Check.",
  "about.sections2.title": "Cured, dried leaf after harvest",
  "about.sections2.body": "Use Quality Grade.",
  "about.sectionsNote":
    "If you use the wrong one, the system will notice and send you to the right place.",
  "about.gradesTitle": "What the grades mean",
  "about.gradeA": "Best leaves. Even colour, good curing, top price.",
  "about.gradeB": "Middle leaves. Small marks or uneven colour, normal price.",
  "about.gradeC": "Weak leaves. Damage or poor curing, lowest price.",
  "about.warnTitle": "Important",
  "about.warnBody":
    "TobaccoScan is a helper, not a replacement for your own judgement or your extension officer. Before you spray any medicine, read the label on the container and follow the amounts written there. If a result looks wrong, trust your eyes and ask your extension officer.",
  "about.ctaTitle": "Ready to check a leaf?",
  "about.ctaBody": "Take one photo and see the result in about a second.",
  "about.ctaButton": "Check a leaf",

  // ── Footer ──
  "footer.tagline":
    "A phone camera and a trained eye for every tobacco farmer. Find disease early, know your grade before you sell.",
  "footer.use": "Use it",
  "footer.learn": "Learn",
  "footer.rights": "Built for the field.",
} as const;

export type TKey = keyof typeof EN;

const SW: Record<TKey, string> = {
  // ── Urambazaji ──
  "nav.home": "Mwanzo",
  "nav.disease": "Angalia Ugonjwa",
  "nav.quality": "Daraja la Ubora",
  "nav.dashboard": "Muhtasari",
  "nav.history": "Historia",
  "nav.about": "Kuhusu",
  "nav.start": "Anza kupima",
  "nav.menu": "Menyu",
  "nav.language": "Lugha",

  // ── Kwa pamoja ──
  "common.loading": "Inapakia…",
  "common.retry": "Jaribu tena",
  "common.refresh": "Onyesha upya",
  "common.back": "Rudi",
  "common.confidence": "Uhakika",
  "common.newAnalysis": "Pima jani jipya",
  "common.noConnection": "Mfumo haupatikani kwa sasa.",
  "common.noConnectionHelp":
    "Huenda mfumo unaanza, au simu yako haina mtandao. Subiri kidogo kisha jaribu tena.",

  // ── Mwanzo ──
  "home.badge": "Tambua jani lako kabla ya kuliuza",
  "home.title1": "Soma jani.",
  "home.title2": "Tambua mavuno.",
  "home.lead":
    "Piga picha ya jani la tumbaku na TobaccoScan itakuambia kama lina ugonjwa, dawa ya kunyunyiza, na daraja litakalopata — ndani ya sekunde, kwa simu yako.",
  "home.ctaDisease": "Angalia ugonjwa",
  "home.ctaQuality": "Angalia daraja la ubora",
  "home.statDiseases": "Magonjwa",
  "home.statGrades": "Madaraja",
  "home.statSpeed": "Jibu ndani ya",
  "home.feature1.title": "Gundua ugonjwa mapema",
  "home.feature1.body":
    "Tambua magonjwa ya madoa kwenye majani wakati bado kuna nafasi ya kutibu na kuokoa zao lako.",
  "home.feature2.title": "Fahamu daraja lako",
  "home.feature2.body":
    "Ona kama jani lililokaushwa ni Daraja A, B au C kabla ya kulipeleka kwa mnunuzi.",
  "home.feature3.title": "Pata dawa",
  "home.feature3.body":
    "Kila majibu huja na dawa ya kutumia, kiasi cha kuchanganya, na mara ngapi kunyunyiza.",
  "home.stepsEyebrow": "Jinsi ya kutumia",
  "home.stepsTitle": "Hatua tatu, mwanzo hadi mwisho.",
  "home.stepsTry": "Jaribu sasa",
  "home.step1.title": "Piga picha",
  "home.step1.body":
    "Piga picha ya jani moja mchana. Jani lijaze picha nzima.",
  "home.step2.title": "Tuma picha",
  "home.step2.body": "Pakia picha kisha subiri kama sekunde moja.",
  "home.step3.title": "Fanya hatua",
  "home.step3.body": "Soma jani lina nini na unatakiwa kufanya nini.",
  "home.detectEyebrow": "Inachotafuta",
  "home.detectTitle": "Imefundishwa kwa majani halisi ya tumbaku.",
  "home.detectBody":
    "Mfumo umejifunza maelfu ya majani ya tumbaku, yenye afya na yenye ugonjwa, hivyo unatambua matatizo yanayoharibu zao hili mara nyingi.",
  "home.ctaTitle": "Pima jani lako la kwanza leo.",
  "home.ctaBody":
    "Piga picha moja upate ugonjwa, daraja na matibabu papo hapo.",
  "home.ctaButton": "Pima jani sasa",

  // ── Kurasa za ugonjwa / ubora ──
  "disease.eyebrow": "Uchunguzi wa ugonjwa",
  "disease.title": "Je, jani hili lina ugonjwa?",
  "disease.lead":
    "Piga picha ya jani bichi la kijani kutoka shambani wakati wa mchana. Mfumo utakuambia kama lina afya au lina ugonjwa wa madoa, na dawa ya kunyunyiza.",
  "quality.eyebrow": "Daraja la ubora",
  "quality.title": "Jani hili lina daraja gani?",
  "quality.lead":
    "Piga picha ya jani lililokaushwa kwenye mwanga wa kutosha. Mfumo utalipa Daraja A, B au C ili ujue thamani yake kabla ya kuuza.",

  // ── Kupakia picha ──
  "upload.dropTitle": "Weka picha ya jani hapa",
  "upload.dropBody":
    "JPG, PNG au WebP, hadi MB 10. Tumia mwanga wa mchana, jani moja lijaze picha, na piga upande wa juu wa jani.",
  "upload.choose": "Chagua picha",
  "upload.camera": "Tumia kamera",
  "upload.ready": "Tayari kupimwa",
  "upload.remove": "Ondoa picha",
  "upload.runTitle": "Pima jani",
  "upload.runDisease":
    "Mfumo utatafuta ugonjwa kwenye jani hili na kukuambia la kufanya.",
  "upload.runQuality":
    "Mfumo utalipa jani hili daraja na kukuambia thamani yake.",
  "upload.run": "Pima sasa",
  "upload.running": "Inapima jani…",
  "upload.speed": "Huchukua kama sekunde moja",
  "upload.tooLarge": "Picha hiyo ni kubwa mno (MB {size}). Kikomo ni MB 10.",
  "upload.failed": "Upimaji haukukamilika. Tafadhali jaribu tena.",
  "upload.getDisease1": "Ugonjwa ulioko kwenye jani, kama upo",
  "upload.getDisease2": "Dawa ya kutumia na jinsi ya kuchanganya",
  "upload.getDisease3": "Kiwango cha uhakika wa mfumo",
  "upload.getDisease4": "Nakala itahifadhiwa kwenye historia yako",
  "upload.getQuality1": "Daraja: A, B au C",
  "upload.getQuality2": "Thamani ya daraja hilo",
  "upload.getQuality3": "Kiwango cha uhakika wa mfumo",
  "upload.getQuality4": "Nakala itahifadhiwa kwenye historia yako",
  "upload.wrongSectionTitle": "Hili ni jani la tumbaku.",
  "upload.goTo": "Nenda {section}",
  "upload.notLeafTip":
    "Dokezo: piga picha ya jani moja tu, mchana, kwenye mandhari safi.",
  "upload.tryAnother": "Jaribu picha nyingine",

  // ── Matokeo ──
  "result.doneDisease": "Uchunguzi wa ugonjwa umekamilika",
  "result.doneQuality": "Upangaji wa daraja umekamilika",
  "result.doneFull": "Uchunguzi umekamilika",
  "result.healthy": "Jani hili lina afya.",
  "result.detected": "Jani hili lina",
  "result.gradeIs": "Jani hili ni",
  "result.backTo": "Rudi {section}",
  "result.uploadAnother": "Pima jani lingine",
  "result.share": "Sambaza",
  "result.export": "Hifadhi kama faili",
  "result.diseaseSection": "Ugonjwa",
  "result.qualitySection": "Daraja la ubora",
  "result.againTitle": "Pima jani lingine",
  "result.againBody": "Piga picha nyingine kwenye {section}, au badilisha sehemu.",
  "result.againButton": "Pima lingine kwenye {section}",
  "result.goOther": "Nenda {section}",
  "result.noQualityModel":
    "Upangaji wa daraja bado hautumiki. Kwa sasa uchunguzi wa ugonjwa pekee unapatikana.",
  "result.recommendations": "Ushauri",

  // ── Matibabu ──
  "tx.title": "Cha kufanya",
  "tx.medicine": "Dawa — chagua moja",
  "tx.treatNow": "Tibu sasa",
  "tx.noTreatment": "Hakuna dawa inayohitajika",
  "tx.confirmFirst": "Thibitisha kwanza",

  // ── Muhtasari ──
  "dash.eyebrow": "Kumbukumbu zako",
  "dash.title": "Muhtasari",
  "dash.lead":
    "Kila kitu ulichopima hadi sasa, kikihesabiwa. Ona ugonjwa unaojitokeza zaidi na mgawanyo wa madaraja yako.",
  "dash.total": "Majani yaliyopimwa",
  "dash.healthy": "Majani yenye afya",
  "dash.confidence": "Wastani wa uhakika",
  "dash.diseased": "Majani yenye ugonjwa",
  "dash.diseaseChart": "Magonjwa yaliyopatikana",
  "dash.diseaseChartSub": "Mara ngapi kila jibu limejitokeza",
  "dash.gradeChart": "Madaraja yaliyotolewa",
  "dash.gradeChartSub": "Jinsi majani yako yalivyopangwa",
  "dash.recent": "Upimaji wa hivi karibuni",
  "dash.viewAll": "Ona yote",
  "dash.empty": "Bado hujapima jani lolote.",
  "dash.emptyCta": "Pima jani lako la kwanza",
  "dash.noData": "Bado hakuna taarifa.",
  "dash.loadFailed": "Imeshindwa kupakia kumbukumbu zako.",

  // ── Historia ──
  "hist.eyebrow": "Kumbukumbu zako",
  "hist.title": "Upimaji uliopita",
  "hist.lead":
    "Kila jani ulilopima limehifadhiwa hapa. Tafuta, chuja, au hifadhi yote kwenye faili.",
  "hist.export": "Hifadhi yote kwenye faili",
  "hist.search": "Tafuta kwa ugonjwa, daraja au namba…",
  "hist.all": "Yote",
  "hist.disease": "Ugonjwa",
  "hist.quality": "Ubora",
  "hist.full": "Vyote",
  "hist.colLeaf": "Jani",
  "hist.colType": "Upimaji",
  "hist.colDisease": "Ugonjwa",
  "hist.colGrade": "Daraja",
  "hist.colWhen": "Lini",
  "hist.colActions": "Ondoa",
  "hist.notRun": "Hakupimwa",
  "hist.empty": "Bado hujapima jani lolote.",
  "hist.emptySearch": "Hakuna kinacholingana na utafutaji wako.",
  "hist.emptyCta": "Pima jani lako la kwanza",
  "hist.loadFailed": "Imeshindwa kupakia upimaji uliopita.",
  "hist.deleteConfirm": "Ondoa upimaji huu kwenye kumbukumbu zako?",
  "hist.deleteFailed": "Imeshindwa kuondoa. Tafadhali jaribu tena.",
  "hist.showing": "Inaonyesha {shown} kati ya {total}",

  // ── Kuhusu ──
  "about.eyebrow": "Kuhusu",
  "about.title": "TobaccoScan inafanya nini",
  "about.lead":
    "TobaccoScan huangalia picha ya jani la tumbaku na kukuambia mambo mawili: kama jani lina ugonjwa, na daraja linalostahili. Imetengenezwa kwa ajili ya wakulima, si maabara.",
  "about.what1.title": "Hutambua ugonjwa",
  "about.what1.body":
    "Piga picha ya jani bichi la kijani kutoka shambani. Mfumo utakuambia kama lina ugonjwa wa madoa, na kutaja dawa ya kunyunyiza, kiasi cha kuchanganya na maji, na mara ngapi.",
  "about.what2.title": "Hupanga daraja la ubora",
  "about.what2.body":
    "Piga picha ya jani lililokaushwa. Mfumo utalipa Daraja A, B au C, ili ujue thamani yake kabla ya kwenda kwa mnunuzi.",
  "about.what3.title": "Huhifadhi kumbukumbu zako",
  "about.what3.body":
    "Kila jani unalopima huhifadhiwa. Unaweza kuyaangalia wakati wowote, au kuhifadhi yote kwenye faili kwenye kompyuta yako.",
  "about.howTitle": "Jinsi ya kupiga picha nzuri",
  "about.how1": "Tumia mwanga wa mchana. Usitumie mwanga wa kamera.",
  "about.how2": "Piga picha ya jani moja kwa wakati.",
  "about.how3": "Jani lijaze picha nzima.",
  "about.how4": "Weka jani kwenye mandhari safi.",
  "about.how5": "Piga picha ya upande wa juu wa jani.",
  "about.sectionsTitle": "Sehemu ipi ya kutumia",
  "about.sections1.title": "Jani bichi la kijani kutoka shambani",
  "about.sections1.body": "Tumia Angalia Ugonjwa.",
  "about.sections2.title": "Jani lililokaushwa baada ya mavuno",
  "about.sections2.body": "Tumia Daraja la Ubora.",
  "about.sectionsNote":
    "Ukitumia sehemu isiyo sahihi, mfumo utagundua na kukuelekeza mahali pazuri.",
  "about.gradesTitle": "Maana ya madaraja",
  "about.gradeA": "Majani bora. Rangi sawa, ukaushaji mzuri, bei ya juu.",
  "about.gradeB": "Majani ya kati. Madoa madogo au rangi isiyo sawa, bei ya kawaida.",
  "about.gradeC": "Majani dhaifu. Uharibifu au ukaushaji hafifu, bei ya chini.",
  "about.warnTitle": "Muhimu",
  "about.warnBody":
    "TobaccoScan ni msaidizi, si mbadala wa uamuzi wako au afisa ugani wako. Kabla ya kunyunyiza dawa yoyote, soma maelekezo kwenye chombo na fuata vipimo vilivyoandikwa. Kama jibu linaonekana si sahihi, amini macho yako na muulize afisa ugani.",
  "about.ctaTitle": "Uko tayari kupima jani?",
  "about.ctaBody": "Piga picha moja uone jibu ndani ya sekunde moja.",
  "about.ctaButton": "Pima jani",

  // ── Chini ──
  "footer.tagline":
    "Kamera ya simu na jicho la mtaalamu kwa kila mkulima wa tumbaku. Gundua ugonjwa mapema, fahamu daraja lako kabla ya kuuza.",
  "footer.use": "Tumia",
  "footer.learn": "Jifunze",
  "footer.rights": "Imetengenezwa kwa ajili ya shambani.",
};

const DICTS: Record<Lang, Record<TKey, string>> = { en: EN, sw: SW };

export const LANGUAGES: { code: Lang; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "sw", label: "Kiswahili", short: "SW" },
];

/** Values substituted into `{placeholders}`. */
type Vars = Record<string, string | number>;

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Vars) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // English on the server and on the first client render; the stored choice is
  // applied in the effect below so the two renders always match.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "sw" || stored === "en") setLangState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: TKey, vars?: Vars) => {
      const dict = DICTS[lang];
      // Fall back to English rather than showing a raw key if a Swahili string
      // is ever missing.
      let out: string = dict[key] ?? EN[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          out = out.replace(`{${k}}`, String(v));
        }
      }
      return out;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside <LanguageProvider>");
  }
  return ctx;
}
