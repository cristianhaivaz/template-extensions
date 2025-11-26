import {
    PaperbackInterceptor,
    type Request,
    type Response,
} from "@paperback/types";

const DOMAIN = "https://dgtread.com";

// Questi headers vengono applicati automaticamente a TUTTE le richieste
// (sia quando cerchi i manga, sia quando scarichi le immagini)
const HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    Referer: `${DOMAIN}/`,
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
};

export class MainInterceptor extends PaperbackInterceptor {
    override async interceptRequest(request: Request): Promise<Request> {
        // Aggiunge i nostri headers "furbi" a ogni richiesta
        request.headers = {
            ...(request.headers ?? {}),
            ...HEADERS,
        };
        return request;
    }

    override async interceptResponse(
        request: Request,
        response: Response,
        data: ArrayBuffer,
    ): Promise<ArrayBuffer> {
        return data;
    }
}
