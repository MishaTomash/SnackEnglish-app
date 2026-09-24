import { apiClient } from "../../shared/api/apiClient";
import type { EnglishLevel } from "../word/types";
import type {
    ChapterNodesResponse,
    ChaptersResponse,
    CompleteNodeResponse,
    StoryNodeContent,
} from "./types";

// chapterId може бути як id, так і slug розділу — бекенд приймає обидва

/** Без level — сервер віддає рівень юзера (або перший, для якого є контент) */
export async function getChapters(level?: EnglishLevel): Promise<ChaptersResponse> {
    const response = await apiClient.get<ChaptersResponse>("/stories", {
        params: level ? { level } : undefined,
    });
    return response.data;
}

export async function getChapterNodes(
    chapterId: string,
): Promise<ChapterNodesResponse> {
    const response = await apiClient.get<ChapterNodesResponse>(
        `/stories/${encodeURIComponent(chapterId)}`,
    );
    return response.data;
}

export async function getNodeContent(
    chapterId: string,
    nodeId: string,
): Promise<StoryNodeContent> {
    const response = await apiClient.get<StoryNodeContent>(
        `/stories/${encodeURIComponent(chapterId)}/nodes/${encodeURIComponent(nodeId)}`,
    );
    return response.data;
}

export async function completeNode(
    chapterId: string,
    nodeId: string,
): Promise<CompleteNodeResponse> {
    const response = await apiClient.post<CompleteNodeResponse>(
        `/stories/${encodeURIComponent(chapterId)}/nodes/${encodeURIComponent(nodeId)}/complete`,
    );
    return response.data;
}