import { Form, type FormSectionElement } from "@paperback/types";

// Una semplice classe vuota.
// Se in futuro vorrai aggiungere opzioni (es. "Mostra titoli originali"), lo farai qui.
export class SettingsForm extends Form {
    override getSections(): FormSectionElement[] {
        return [];
    }
}
