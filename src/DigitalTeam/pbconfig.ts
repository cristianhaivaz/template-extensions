import { ContentRating, SourceIntents } from "@paperback/types";

export default {
    name: "DigitalTeam",
    description: "Estensione per DigitalTeam (dgtread.com)",
    version: "1.0.4",
    icon: "icon.png",
    language: "it",
    contentRating: ContentRating.MATURE,
    capabilities:
        SourceIntents.CHAPTER_PROVIDING |
        // NOTA: Qui sotto c'è un errore di battitura intenzionale (SECIONS invece di SECTIONS)
        // perché il sistema di Paperback è scritto così al momento.
        SourceIntents.DISCOVER_SECIONS_PROVIDING |
        SourceIntents.SEARCH_RESULTS_PROVIDING |
        SourceIntents.SETTINGS_FORM_PROVIDING,
    badges: [],
    developers: [
        {
            name: "TuoNome",
            website: "https://github.com/cristianhaivaz",
        },
    ],
};
