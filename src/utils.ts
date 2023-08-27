/**
 * Type identifiers for use with inversify.
 */
export const EDITOR_TYPES = {
    // Enableable and disableable tools that can be used to e.g. create new elements.
    DfdTool: Symbol("DfdTool"),
    // All IUIExtension instances that are bound to this symbol will
    // be loaded and enabled at editor startup.
    DefaultUIElement: Symbol("DefaultUIElement"),
};

export const FIT_TO_SCREEN_PADDING = 75;

export function generateRandomSprottyId(): string {
    return Math.random().toString(36).substring(7);
}

const context = document.createElement("canvas").getContext("2d");
export function calculateTextWidth(text: string | undefined, font: string = "11pt sans-serif"): number {
    if (!context) {
        throw new Error("Could not create canvas context used to measure text width");
    }

    if (!text || text.length === 0) {
        return 20;
    }

    context.font = font;
    const metrics = context.measureText(text);
    return Math.round(metrics.width);
}
