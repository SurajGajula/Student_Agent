import { GoogleAuth } from 'google-auth-library';
interface ServiceAccountKey {
    project_id: string;
    client_email: string;
    [key: string]: unknown;
}
interface VertexAIClient {
    token: string;
    projectId: string;
}
export declare function getAuthClient(): GoogleAuth | null;
export declare function initializeGeminiClient(): Promise<boolean>;
export declare function getAccessToken(): Promise<string>;
export declare function getGeminiClient(): VertexAIClient | null;
export declare function isVertexAI(): boolean;
export declare function getProjectId(): string | null;
export declare function getServiceAccountKey(): ServiceAccountKey | null;
export declare function setGeminiClient(client: VertexAIClient): void;
export declare function setUseVertexAI(value: boolean): void;
export {};
//# sourceMappingURL=gemini.d.ts.map