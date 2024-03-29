import { inject, injectable } from "inversify";
import {
    AbstractUIExtension,
    IActionDispatcher,
    MouseListener,
    SChildElementImpl,
    SModelElementImpl,
    SModelRootImpl,
    SetUIExtensionVisibilityAction,
    TYPES,
} from "sprotty";
import { Action } from "sprotty-protocol";
import { GdprNodeImpl } from "./nodes";
import { GdprSubTypeEditUI } from "./subTypeEditUI";

import "./validationErrorsPopup.css";

@injectable()
export class GdprValidationResultPopupMouseListener extends MouseListener {
    private stillTimeout: NodeJS.Timeout | undefined;
    private lastPosition = { x: 0, y: 0 };

    constructor(
        @inject(TYPES.IActionDispatcher) private readonly actionDispatcher: IActionDispatcher,
        @inject(GdprSubTypeEditUI) private readonly subTypeEditUI: GdprSubTypeEditUI,
    ) {
        super();
    }

    mouseMove(target: SModelElementImpl, event: MouseEvent): (Action | Promise<Action>)[] {
        const gdprNode = this.findGdprNode(target);
        if (!gdprNode) {
            if (this.stillTimeout) {
                clearTimeout(this.stillTimeout);
                this.stillTimeout = undefined;
            }
            return [];
        }

        if (this.lastPosition.x !== event.clientX || this.lastPosition.y !== event.clientY) {
            this.lastPosition = { x: event.clientX, y: event.clientY };
            // Mouse has moved, so we reset the timeout
            if (this.stillTimeout) {
                clearTimeout(this.stillTimeout);
            }
            this.stillTimeout = setTimeout(() => {
                // When the mouse has not moved for 500ms, we show the popup
                this.stillTimeout = undefined;

                if (gdprNode.opacity !== 1) {
                    // Only show when opacity is 1.
                    // The opacity is not 1 when the node is currently being created but has not been
                    // placed yet or when the node is being filtered out by a global node filter.
                    // In this case we don't want to show the popup
                    // and interfere with the creation process.
                    return;
                }

                if (this.subTypeEditUI.isOpen()) {
                    // The sub type edit UI is open, so we don't want to show the popup
                    // because it would interfere with the GDPR sub type edit selector UI.
                    return;
                }

                this.showPopup(gdprNode);
            }, 500);
        }

        return [];
    }

    private findGdprNode(currentNode: SModelElementImpl): GdprNodeImpl | undefined {
        if (currentNode instanceof GdprNodeImpl) {
            return currentNode;
        } else if (currentNode instanceof SChildElementImpl && currentNode.parent) {
            return this.findGdprNode(currentNode.parent);
        } else {
            return undefined;
        }
    }

    private showPopup(target: GdprNodeImpl): void {
        if (target.validateNode() === true) {
            // no validation errors, all fine. No need to show the popup.
            return;
        }

        this.actionDispatcher.dispatch(
            SetUIExtensionVisibilityAction.create({
                extensionId: GdprValidationResultPopupUI.ID,
                visible: true,
                contextElementsId: [target.id],
            }),
        );
    }

    public getMousePosition(): { x: number; y: number } {
        return this.lastPosition;
    }
}

@injectable()
export class GdprValidationResultPopupUI extends AbstractUIExtension {
    static readonly ID = "gdpr-validation-result-popup";

    private readonly validationParagraph = document.createElement("p") as HTMLParagraphElement;

    constructor(
        @inject(GdprValidationResultPopupMouseListener)
        private readonly mouseListener: GdprValidationResultPopupMouseListener,
    ) {
        super();
    }

    id(): string {
        return GdprValidationResultPopupUI.ID;
    }

    containerClass(): string {
        return this.id();
    }

    protected override initializeContents(containerElement: HTMLElement): void {
        containerElement.classList.add("ui-float");
        containerElement.appendChild(this.validationParagraph);

        document.addEventListener("mousemove", (event) => {
            if (containerElement.style.visibility === "hidden") {
                // Not visible anyway, no need to do the check
                return;
            }

            // If mouse not in popup => hide
            const rect = containerElement.getBoundingClientRect();
            console.log(rect);
            if (
                event.clientX < rect.left ||
                event.clientX > rect.right ||
                event.clientY < rect.top ||
                event.clientY > rect.bottom
            ) {
                this.hide();
            }
        });
    }

    protected override onBeforeShow(
        containerElement: HTMLElement,
        root: Readonly<SModelRootImpl>,
        ...contextElementIds: string[]
    ): void {
        if (contextElementIds.length !== 1) {
            this.validationParagraph.innerText =
                "UI Error: Expected exactly one context element id, but got " + contextElementIds.length;
            return;
        }

        const node = root.index.getById(contextElementIds[0]);
        if (!(node instanceof GdprNodeImpl)) {
            this.validationParagraph.innerText =
                "UI Error: Expected context element to be a GdprNodeImpl, but got " + node;
            return;
        }

        const validationResults = node.validateNode();
        if (validationResults === true) {
            // no validation errors, all fine. No need to show the popup.
            this.hide();
            return;
        }

        const mousePosition = this.mouseListener.getMousePosition();

        // Set position
        // 2 offset to ensure the mouse is inside the popup when showing it.
        // Otherwise it would be on the node instead of the popup because of the rounded corners.
        // When moving the cursor from the node to the popup, the popup would move a bit
        // because the cursor is going a bit over the model and then the popup would re-show
        // with the new position after the timeout.
        containerElement.style.left = `${mousePosition.x - 2}px`;
        containerElement.style.top = `${mousePosition.y - 2}px`;

        // Set content
        this.validationParagraph.innerText = "This node is invalid because";
        const validationUnorderedList = document.createElement("ul");
        validationResults.forEach((validationResult) => {
            const validationListItem = document.createElement("li");
            validationListItem.innerText = validationResult;
            validationUnorderedList.appendChild(validationListItem);
        });

        this.validationParagraph.appendChild(validationUnorderedList);
    }
}
