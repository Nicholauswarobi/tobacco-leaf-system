/**
 * Swahili wording for the content the backend returns in English.
 *
 * Disease names, descriptions, treatments and grades come from the API as
 * English strings. Rather than asking the backend for a language (which would
 * mean re-running the analysis every time somebody flips the switch, and would
 * leave already-saved results in the wrong language), the small, fixed
 * vocabulary is mirrored here and swapped at display time.
 *
 * Anything without a Swahili entry falls back to the English the API sent, so
 * a new disease class shows up in English rather than disappearing.
 */
import type { DiseaseTreatment, Lang } from "@/types";

const DISEASE_NAME_SW: Record<string, string> = {
  Healthy: "Lenye afya",
  "Alternaria Leaf Spot": "Ugonjwa wa Madoa ya Alternaria",
  "Cercospora Leaf Spot": "Ugonjwa wa Madoa ya Cercospora",
  "Tobacco Mosaic Virus": "Virusi vya Mosaic ya Tumbaku",
};

const DISEASE_DESC_SW: Record<string, string> = {
  Healthy:
    "Jani halionyeshi dalili zozote za ugonjwa. Rangi, muundo na mishipa viko katika hali ya kawaida.",
  "Alternaria Leaf Spot":
    "Ugonjwa wa fangasi. Hutengeneza madoa ya kahawia yenye duara ndani ya duara, ambayo hupanuka na kuungana, hivyo kudhoofisha jani na kushusha thamani yake sokoni.",
  "Cercospora Leaf Spot":
    "Ugonjwa wa fangasi. Hutengeneza madoa madogo ya mviringo yenye katikati ya rangi ya udongo na pembezoni meusi. Ukishamiri, majani huanguka kabla ya wakati.",
  "Tobacco Mosaic Virus":
    "Ugonjwa wa virusi. Jani hupata mabaka ya kijani kilichopauka na kijani kilichokolea, na hujikunja au kudumaa.",
};

const GRADE_NAME_SW: Record<string, string> = {
  "Grade A": "Daraja A",
  "Grade B": "Daraja B",
  "Grade C": "Daraja C",
};

const GRADE_DESC_SW: Record<string, string> = {
  "Grade A":
    "Ubora wa juu. Majani yanafanana, yamekaushwa vizuri, yana rangi nzuri na mafuta ya kutosha. Yanafaa kwa soko la nje.",
  "Grade B":
    "Ubora wa kati. Rangi na muundo vinakubalika, lakini kuna madoa madogo au tofauti kidogo ya rangi. Yanafaa kwa soko la ndani.",
  "Grade C":
    "Ubora wa chini. Rangi isiyo sawa, uharibifu, au ukaushaji hafifu. Hutumika kwa bidhaa za daraja la chini.",
};

const MARKET_VALUE_SW: Record<string, string> = {
  "Grade A": "Bei ya juu kabisa",
  "Grade B": "Bei ya kawaida ya soko",
  "Grade C": "Bei ya chini",
};

const SPRAY_CAUTION_SW =
  "Fuata kipimo kilichoandikwa kwenye chombo cha dawa. Vaa glavu na barakoa. Acha kunyunyiza siku 14 kabla ya mavuno.";

const TREATMENT_SW: Record<string, DiseaseTreatment> = {
  "Alternaria Leaf Spot": {
    urgency: "Tibu sasa",
    summary: "Nyunyiza dawa ya fangasi na ondoa majani yaliyoathirika.",
    medicines: [
      {
        name: "Mancozeb 80% WP",
        dose: "2.5 g kwa lita 1 ya maji",
        interval: "Kila siku 7, hadi mara 3",
      },
      {
        name: "Azoxystrobin 250 SC",
        dose: "1 ml kwa lita 1 ya maji",
        interval: "Kila siku 10, hadi mara 2",
      },
      {
        name: "Copper oxychloride 50% WP",
        dose: "3 g kwa lita 1 ya maji",
        interval: "Kila siku 10 (chaguo la bei nafuu)",
      },
    ],
    actions: [
      "Ondoa na choma majani yaliyoathirika.",
      "Mwagilia chini ya mmea, si juu ya majani.",
      "Panua nafasi kati ya mimea ili hewa ipite.",
    ],
    caution: SPRAY_CAUTION_SW,
  },
  "Cercospora Leaf Spot": {
    urgency: "Tibu sasa",
    summary: "Nyunyiza kila siku 7 na ondoa majani ya chini yaliyoathirika.",
    medicines: [
      {
        name: "Chlorothalonil 75% WP",
        dose: "2 g kwa lita 1 ya maji",
        interval: "Kila siku 7, hadi mara 3",
      },
      {
        name: "Copper oxychloride 50% WP",
        dose: "3 g kwa lita 1 ya maji",
        interval: "Kila siku 10",
      },
      {
        name: "Difenoconazole 250 EC",
        dose: "0.5 ml kwa lita 1 ya maji",
        interval: "Kila siku 14, hadi mara 2",
      },
    ],
    actions: [
      "Ondoa kwanza majani ya chini yenye madoa mengi.",
      "Safisha mabaki yote ya zao baada ya mavuno.",
      "Badilisha shamba msimu ujao.",
    ],
    caution: SPRAY_CAUTION_SW,
  },
  Healthy: {
    urgency: "Hakuna dawa inayohitajika",
    summary: "Hakuna ugonjwa uliogundulika. Usinyunyize dawa; endelea kukagua.",
    medicines: [],
    actions: [
      "Kagua shamba kila siku 7.",
      "Endelea na umwagiliaji na mbolea kama kawaida.",
      "Angalia unyevu kwenye mistari minene.",
    ],
    caution: null,
  },
};

const TREATMENT_FALLBACK_SW: DiseaseTreatment = {
  urgency: "Thibitisha kwanza",
  summary:
    "Aina hii haipo kwenye mwongozo wa matibabu. Thibitisha kabla ya kunyunyiza dawa yoyote.",
  medicines: [],
  actions: [
    "Piga picha majani yaliyoathirika.",
    "Wasiliana na afisa ugani wa eneo lako.",
  ],
  caution: null,
};

/** Disease name in the reader's language. */
export function diseaseName(label: string, lang: Lang): string {
  return lang === "sw" ? DISEASE_NAME_SW[label] ?? label : label;
}

/** Disease description, falling back to whatever the API sent. */
export function diseaseDescription(
  label: string,
  apiDescription: string,
  lang: Lang
): string {
  return lang === "sw" ? DISEASE_DESC_SW[label] ?? apiDescription : apiDescription;
}

export function gradeName(grade: string, lang: Lang): string {
  return lang === "sw" ? GRADE_NAME_SW[grade] ?? grade : grade;
}

export function gradeDescription(
  grade: string,
  apiDescription: string,
  lang: Lang
): string {
  return lang === "sw" ? GRADE_DESC_SW[grade] ?? apiDescription : apiDescription;
}

export function marketValue(
  grade: string,
  apiValue: string,
  lang: Lang
): string {
  return lang === "sw" ? MARKET_VALUE_SW[grade] ?? apiValue : apiValue;
}

/**
 * Treatment block in the reader's language.
 *
 * Medicine product names are left untranslated on purpose — a farmer has to
 * match them against what is printed on the container in the agrovet.
 */
export function localizeTreatment(
  label: string,
  treatment: DiseaseTreatment,
  lang: Lang
): DiseaseTreatment {
  if (lang !== "sw") return treatment;
  return TREATMENT_SW[label] ?? TREATMENT_FALLBACK_SW;
}
