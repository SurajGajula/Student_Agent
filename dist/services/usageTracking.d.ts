import '../load-env.js';
/**
 * Check if user has exceeded monthly token limit
 */
export declare function checkTokenLimit(userId: string, tokensToUse: number): Promise<{
    allowed: boolean;
    remaining: number;
    limit: number;
    current: number;
}>;
/**
 * Record token usage for a user
 */
export declare function recordTokenUsage(userId: string, tokens: number): Promise<void>;
/**
 * Get user usage statistics
 */
export declare function getUserUsage(userId: string): Promise<{
    planName: string;
    tokensUsed: number;
    monthlyLimit: number;
    remaining: number;
}>;
//# sourceMappingURL=usageTracking.d.ts.map