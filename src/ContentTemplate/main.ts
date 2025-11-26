import {
    BasicRateLimiter,
    ContentRating,
    Extension,
    MangaProviding,
    ChapterProviding,
    SearchResultsProviding,
    SourceManga,
    Chapter,
    ChapterDetails,
    PagedResults,
    SearchQuery,
    SearchResultItem,
    TagSection,
    Request,
    Response
} from "@paperback/types";
import * as cheerio from "cheerio"; 
import { MainInterceptor } from "./network";
import { SettingsForm } from "./forms";

const DOMAIN = 'https://dgtread.com/';

type DigitalTeamImplementation = Extension & MangaProviding & ChapterProviding & SearchResultsProviding;

export class DigitalTeamExtension implements DigitalTeamImplementation {
    
    // Configurazione limiti richieste (per non essere bloccati dal sito)
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

    // 1. OTTENERE DETTAGLI DEL MANGA
    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        // Scarica la pagina del manga
        const response = await fetch(`${DOMAIN}/manga/${mangaId}`);
        const data = await response.text();
        const $ = cheerio.load(data);
        
        // Estrai i dati usando i selettori CSS
        const title = $('div.post-title h1').text().trim() || $('h1').text().trim();
        const image = $('div.summary_image img').attr('src') || '';
        const author = $('div.author-content').first().text().trim() || 'Unknown';
        const description = $('div.description-summary p').text().trim() || 'Nessuna descrizione.';
        
        let status = 'ONGOING';
        const statusText = $('div.post-status div.summary-content').text().trim().toLowerCase();
        if (statusText.includes('complet') || statusText.includes('end')) status = 'COMPLETED';

        return {
            mangaId: mangaId,
            mangaInfo: {
                primaryTitle: title,
                thumbnailUrl: image,
                synopsis: description,
                status: status,
                author: author,
                contentRating: ContentRating.MATURE, 
                shareUrl: `${DOMAIN}/manga/${mangaId}`
            }
        };
    }

    // 2. OTTENERE LA LISTA DEI CAPITOLI
    async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
        const response = await fetch(`${DOMAIN}/manga/${sourceManga.mangaId}`);
        const data = await response.text();
        const $ = cheerio.load(data);

        const chapters: Chapter[] = [];
        const chapterNodes = $('li.wp-manga-chapter');

        let counter = 0;
        for (const node of chapterNodes) {
            const titleNode = $(node).find('a');
            const title = titleNode.text().trim();
            const url = titleNode.attr('href') ?? '';
            
            // L'ID del capitolo è l'ultima parte dell'URL
            const chapterId = url.split('/').filter(x => x.length > 0).pop();

            if (!chapterId) continue;

            // Cerca il numero nel titolo
            const chapNumRegex = title.match(/(\d+(\.\d+)?)/);
            let chapNum = 0;
            if (chapNumRegex && chapNumRegex[1]) chapNum = Number(chapNumRegex[1]);
            
            // Se non trova il numero, usa un contatore
            if (chapNum === 0) chapNum = counter++;

            chapters.push({
                chapterId: chapterId,
                sourceManga: sourceManga,
                langCode: 'it',
                chapNum: chapNum,
                title: title,
                // time: new Date() // Opzionale
            });
        }
        return chapters;
    }

    // 3. OTTENERE LE PAGINE DEL CAPITOLO
    async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
        const response = await fetch(`${DOMAIN}/manga/${chapter.sourceManga.mangaId}/${chapter.chapterId}/`);
        const data = await response.text();
        const $ = cheerio.load(data);

        const pages: string[] = [];
        const pageNodes = $('div.page-break img');

        for (const page of pageNodes) {
            let url = $(page).attr('src');
            if (!url) url = $(page).attr('data-src');
            
            if (url) {
                pages.push(url.trim());
            }
        }

        return {
            id: chapter.chapterId,
            mangaId: chapter.sourceManga.mangaId,
            pages: pages
        };
    }

    // 4. RICERCA MANGA
    async getSearchResults(query: SearchQuery, metadata?: any): Promise<PagedResults<SearchResultItem>> {
        const page = metadata?.page ?? 1;
        // La ricerca su WordPress/Madara funziona così
        const searchUrl = `${DOMAIN}/page/${page}/?s=${encodeURIComponent(query.title ?? '')}&post_type=wp-manga`;

        const response = await fetch(searchUrl);
        const data = await response.text();
        const $ = cheerio.load(data);

        const results: SearchResultItem[] = [];
        const nodes = $('div.c-tabs-item__content');

        for (const node of nodes) {
            const titleNode = $(node).find('div.post-title h3 a');
            const title = titleNode.text().trim();
            const href = titleNode.attr('href');
            const id = href?.split('/').filter(x => x.length > 0).pop();
            const image = $(node).find('img').attr('src') ?? '';

            if (id && title) {
                results.push({
                    mangaId: id,
                    title: title,
                    imageUrl: image,
                    subtitle: 'Italiano'
                });
            }
        }

        return {
            items: results,
            metadata: { page: page + 1 }
        };
    }
}

export const ContentTemplate = new DigitalTeamExtension();