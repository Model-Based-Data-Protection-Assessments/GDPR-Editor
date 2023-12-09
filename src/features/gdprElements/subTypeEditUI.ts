import {
    AbstractUIExtension,
    Command,
    CommandExecutionContext,
    CommandReturn,
    IActionDispatcher,
    MouseListener,
    SChildElementImpl,
    SModelElementImpl,
    SModelRootImpl,
    SetUIExtensionVisibilityAction,
    TYPES,
    getAbsoluteClientBounds,
} from "sprotty";
import { Action } from "sprotty-protocol";
import { GdprSubTypeNodeImpl } from "./nodes";
import { inject, injectable } from "inversify";
import { DOMHelper } from "sprotty/lib/base/views/dom-helper";

export class GdprSubTypeEditUIMouseListener extends MouseListener {
    private uiOpen: boolean = false;

    private getSubTypeNode(target: SModelElementImpl): GdprSubTypeNodeImpl<string> | undefined {
        if (target instanceof GdprSubTypeNodeImpl) {
            return target;
        } else if (target instanceof SChildElementImpl && target.parent) {
            return this.getSubTypeNode(target.parent);
        } else {
            return undefined;
        }
    }

    mouseDown(target: SModelElementImpl, event: MouseEvent): (Action | Promise<Action>)[] {
        // Open UI when a sub type node is right-clicked (button 2 is the right mouse button
        if (event.button === 2) {
            const subTypeNode = this.getSubTypeNode(target);
            if (subTypeNode) {
                event.preventDefault();
                this.uiOpen = true;
                return [
                    SetUIExtensionVisibilityAction.create({
                        extensionId: GdprSubTypeEditUI.ID,
                        visible: true,
                        contextElementsId: [subTypeNode.id],
                    }),
                ];
            }
        } else if (this.uiOpen) {
            // User has clicked somewhere else inside the graph, so we close the UI because
            // the user is probably done editing the type of the node.
            this.uiOpen = false;
            return [
                SetUIExtensionVisibilityAction.create({
                    extensionId: GdprSubTypeEditUI.ID,
                    visible: false,
                }),
            ];
        }

        return [];
    }
}

@injectable()
export class GdprSubTypeEditUI extends AbstractUIExtension {
    static readonly ID = "gdpr-subtype-edit-ui";

    private node: GdprSubTypeNodeImpl<string> | undefined;
    private subTypeSelect = document.createElement("select") as HTMLSelectElement;

    id(): string {
        return GdprSubTypeEditUI.ID;
    }
    containerClass(): string {
        return this.id();
    }

    constructor(
        @inject(TYPES.IActionDispatcher) private actionDispatcher: IActionDispatcher,
        @inject(TYPES.DOMHelper) private domHelper: DOMHelper,
    ) {
        super();
    }

    protected initializeContents(containerElement: HTMLElement): void {
        // Disables the context menu for the select input.
        // When right clicking a node and the cursor is where the select input will be shown,
        // the right click is carried through to the select input which would open the context menu
        // from the browser. We don't want that, and the click should just be ignored.
        this.subTypeSelect.oncontextmenu = (event) => event.preventDefault();
        this.subTypeSelect.onchange = () => this.saveAndHide();

        containerElement.appendChild(this.subTypeSelect);
        containerElement.classList.add("ui-float");
    }

    protected onBeforeShow(
        containerElement: HTMLElement,
        root: Readonly<SModelRootImpl>,
        ...contextElementIds: string[]
    ): void {
        // Loads data for the node that shall be edited, which is defined by the context element id.
        if (contextElementIds.length !== 1) {
            throw new Error(
                "Expected exactly one context element id which should be the port that shall be shown in the UI.",
            );
        }
        this.node = root.index.getById(contextElementIds[0]) as GdprSubTypeNodeImpl<string>;

        // Position the UI at the top of the node
        const nodeBounds = getAbsoluteClientBounds(this.node, this.domHelper, this.options);
        containerElement.style.left = `${nodeBounds.x}px`;
        containerElement.style.top = `calc(${nodeBounds.y}px - 1.5em)`;

        // Fill the select box with options based on the node
        // Delete all options, yes this is the simplest way to clear a js array when it is readonly. Yes this really works
        this.subTypeSelect.options.length = 0;
        this.subTypeSelect.options.add(new Option("None | Select a sub type", ""));
        this.node.getPossibleSubTypes().forEach((subType) => {
            this.subTypeSelect.options.add(new Option(subType, subType));
        });

        // Expand select to show all options without the need to open the dropdown
        this.subTypeSelect.size = this.subTypeSelect.options.length;
    }

    private saveAndHide(): void {
        if (!this.node) {
            return;
        }

        this.actionDispatcher.dispatch(SetGdprSubTypeAction.create(this.node.id, this.subTypeSelect.value));
        this.hide();
    }
}

export interface SetGdprSubTypeAction extends Action {
    kind: typeof SetGdprSubTypeAction.KIND;
    nodeId: string;
    subType?: string;
}
export namespace SetGdprSubTypeAction {
    export const KIND = "setGdprSubType";
    export function create(nodeId: string, subType: string): SetGdprSubTypeAction {
        return {
            kind: KIND,
            nodeId,
            // Converting an empty string to undefined
            subType: subType || undefined,
        };
    }
}

@injectable()
export class SetGdprSubTypeCommand extends Command {
    static readonly KIND = SetGdprSubTypeAction.KIND;

    constructor(@inject(TYPES.Action) private action: SetGdprSubTypeAction) {
        super();
    }

    private node: GdprSubTypeNodeImpl<string> | undefined;
    private previousSubType: string | undefined;

    execute(context: CommandExecutionContext): CommandReturn {
        const node = context.root.index.getById(this.action.nodeId);
        if (!(node instanceof GdprSubTypeNodeImpl)) {
            throw new Error(`Node with id ${this.action.nodeId} is not a GdprSubTypeNodeImpl, cannot set sub type`);
        }
        this.node = node;

        // Check whether the sub type is valid for the node.
        // First term is to check whether a value was provided. Not providing anything (undefined) is always valid.
        if (this.action.subType && !node.getPossibleSubTypes().includes(this.action.subType)) {
            throw new Error(`Sub type ${this.action.subType} is not a valid sub type for node ${this.action.nodeId}`);
        }

        this.previousSubType = node.subType;
        node.subType = this.action.subType;

        return context.root;
    }

    undo(context: CommandExecutionContext): CommandReturn {
        if (this.node) {
            this.node.subType = this.previousSubType;
        }

        return context.root;
    }

    redo(context: CommandExecutionContext): CommandReturn {
        if (this.node) {
            this.node.subType = this.action.subType;
        }

        return context.root;
    }
}
