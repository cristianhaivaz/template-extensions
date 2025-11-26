import { BasicRateLimiter, ContentRating } from "@paperback/types";
import type {
    Chapter,
    ChapterDetails,
    ChapterProviding,
    Extension,
    MangaProviding,
    PagedResults,
    SearchFilter,
    SearchQuery,
    SearchResultItem,
    SearchResultsProviding,
    SourceManga,
} from "@paperback/types";
import * as cheerio from "cheerio";
import { SettingsForm } from "./forms";
import { MainInterceptor } from "./network";

const DOMAIN = "https://dgtread.com";

const HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    Referer: `${DOMAIN}/`,
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
};

type DigitalTeamImplementation = Extension &
    MangaProviding &
    ChapterProviding &
    SearchResultsProviding;

interface SearchMetadata {
    page?: number;
}

export class DigitalTeamExtension implements DigitalTeamImplementation {
    globalRateLimiter = new BasicRateLimiter("main", {
        numberOfRequests: 4,
        bufferInterval: 1,
        ignoreImages: true,
    });

    mainInterceptor = new MainInterceptor("main");

    async initialise(): Promise<void> {
        this.globalRateLimiter.registerInterceptor();
        this.mainInterceptor.registerInterceptor();
    }

    async getSettingsForm(): Promise<SettingsForm> {
        return new SettingsForm();
    }

    async getSearchFilters(): Promise<SearchFilter[]> {
        return [];
    }

    async _getHtml(url: string): Promise<cheerio.CheerioAPI> {
        const response = await fetch(url, { headers: HEADERS });
        const data = await response.text();
        return cheerio.load(data);
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const $ = await this._getHtml(`${DOMAIN}/manga/${mangaId}`);

        const title =
            $("div.post-title h1").text().trim() || $("h1").text().trim();
        const image =
            $("div.summary_image img").attr("src") ||
            $("div.summary_image img").attr("data-src") ||
            "";
        const author =
            $("div.author-content").first().text().trim() || "Unknown";
        const description =
            $("div.description-summary p").text().trim() ||
            "Nessuna descrizione.";

        let status = "ONGOING";
        const statusText = $("div.post-status div.summary-content")
            .text()
            .trim()
            .toLowerCase();
        if (statusText.includes("complet") || statusText.includes("end"))
            status = "COMPLETED";

        return {
            mangaId: mangaId,
            mangaInfo: {
                primaryTitle: title,
                secondaryTitles: [],
                thumbnailUrl: image,
                synopsis: description,
                status: status,
                author: author,
                tagGroups: [],
                rating: 0,
                contentRating: ContentRating.MATURE,
                shareUrl: `${DOMAIN}/manga/${mangaId}`,
            },
        };
    }

    async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
        let $ = await this._getHtml(`${DOMAIN}/manga/${sourceManga.mangaId}`);
        let chapterNodes = $("li.wp-manga-chapter");

        if (chapterNodes.length === 0) {
            const response = await fetch(
                `${DOMAIN}/manga/${sourceManga.mangaId}/ajax/chapters/`,
                {
                    method: "POST",
                    headers: HEADERS,
                },
            );
            const data = await response.text();
            $ = cheerio.load(data);
            chapterNodes = $("li.wp-manga-chapter");
        }

        const chapters: Chapter[] = [];
        let counter = 0;

        for (const node of chapterNodes) {
            const titleNode = $(node).find("a");
            const title = titleNode.text().trim();
            const url = titleNode.attr("href") ?? "";

            const chapterId = url
                .split("/")
                .filter((x) => x.length > 0)
                .pop();

            if (!chapterId) continue;

            const chapNumRegex = title.match(/(\d+(\.\d+)?)/);
            let chapNum = 0;
            if (chapNumRegex && chapNumRegex[1])
                chapNum = Number(chapNumRegex[1]);
            if (chapNum === 0) chapNum = counter++;

            // RIMOSSO 'time' che causava l'errore
            chapters.push({
                chapterId: chapterId,
                sourceManga: sourceManga,
                langCode: "it",
                chapNum: chapNum,
                title: title,
            });
        }
        return chapters;
    }

    async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
        const $ = await this._getHtml(
            `${DOMAIN}/manga/${chapter.sourceManga.mangaId}/${chapter.chapterId}/?style=list`,
        );

        const pages: string[] = [];
        const pageNodes = $("div.page-break img");

        for (const page of pageNodes) {
            let url = $(page).attr("src");
            if (!url || url.includes("data:image"))
                url = $(page).attr("data-src");

            if (url) {
                pages.push(url.trim());
            }
        }

        return {
            id: chapter.chapterId,
            mangaId: chapter.sourceManga.mangaId,
            pages: pages,
        };
    }

    async getSearchResults(
        query: SearchQuery,
        metadata?: SearchMetadata,
    ): Promise<PagedResults<SearchResultItem>> {
        const page = metadata?.page ?? 1;
        const searchUrl = `${DOMAIN}/page/${page}/?s=${encodeURIComponent(query.title ?? "")}&post_type=wp-manga`;

        const $ = await this._getHtml(searchUrl);

        const results: SearchResultItem[] = [];
        const nodes = $("div.c-tabs-item__content");

        for (const node of nodes) {
            const titleNode = $(node).find("div.post-title h3 a");
            const title = titleNode.text().trim();
            const href = titleNode.attr("href");
            const id = href
                ?.split("/")
                .filter((x) => x.length > 0)
                .pop();
            const image =
                $(node).find("img").attr("src") ||
                $(node).find("img").attr("data-src") ||
                "";

            if (id && title) {
                results.push({
                    mangaId: id,
                    title: title,
                    imageUrl: image,
                    subtitle: "Italiano",
                });
            }
        }

        return {
            items: results,
            metadata: { page: page + 1 },
        };
    }
}

export const ContentTemplate = new DigitalTeamExtension();
