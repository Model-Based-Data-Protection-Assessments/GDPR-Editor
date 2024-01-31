import {
    AbstractUIExtension,
    CommandStack,
    KeyListener,
    SChildElementImpl,
    SConnectableElementImpl,
    SEdgeImpl,
    SModelElementImpl,
    SNodeImpl,
    TYPES,
} from "sprotty";
import {
    GdprNodeImpl,
    GdprSubTypeNodeImpl,
    gdprDataTypes,
    gdprLegalBasisTypes,
    gdprProcessingTypes,
    gdprRoleTypes,
} from "./nodes";
import { inject } from "inversify";
import { Action } from "sprotty-protocol";
import { matchesKeystroke } from "sprotty/lib/utils/keyboard";

import "./filterUi.css";

export class GdprFilterUI extends AbstractUIExtension implements KeyListener {
    static readonly ID = "gdpr-filter-ui";

    private nodeTypeSelectElement = document.createElement("select") as HTMLSelectElement;
    private nodeSubtypeSelectElement = document.createElement("select") as HTMLSelectElement;
    private nodeNameInputElement = document.createElement("input") as HTMLInputElement;
    private filterDirectionSelectElement = document.createElement("select") as HTMLSelectElement;
    private searchDepthInputElement = document.createElement("input") as HTMLInputElement;

    private static readonly nodeTypes: Record<string, readonly string[]> = {
        Processing: gdprProcessingTypes,
        "Legal Basis": gdprLegalBasisTypes,
        Role: gdprRoleTypes,
        Data: gdprDataTypes,
        Purpose: [],
    };

    constructor(@inject(TYPES.ICommandStack) private readonly commandStack: CommandStack) {
        super();
    }

    id(): string {
        return GdprFilterUI.ID;
    }

    containerClass(): string {
        return this.id();
    }

    protected initializeContents(containerElement: HTMLElement): void {
        containerElement.classList.add("ui-float");
        containerElement.innerHTML = `
            <input type="checkbox" id="accordion-state-gdpr-filter" class="accordion-state" hidden>
            <label for="accordion-state-gdpr-filter">
                <div class="accordion-button"><span class="codicon codicon-search"></span> Filter Nodes</div>
            </label>
            <div class="accordion-content">
                <div class="gdpr-filter-ui-inner">
                    <p><span>Node Type:</span> <select id="gdpr-filter-node-type"></select></p>
                    <p><span>Node Subtype:</span> <select id="gdpr-filter-node-subtype"></select></p>
                    <p><span>Node Name:</span> <input type="text" id="gdpr-filter-node-name"></p>
                    <p><span>Direction:</span>
                        <select id="gdpr-filter-direction">
                            <option value="references">References</option>
                            <option value="referenced">Referenced by</option>
                            <option value="both">Both</option>
                        </select>
                    </p>
                    <p><span>Search depth:</span> <input type="number" id="gdpr-filter-search-depth" value="0"></p>
                </div>
            </div>
        `;

        this.nodeTypeSelectElement = containerElement.querySelector("#gdpr-filter-node-type") as HTMLSelectElement;
        this.nodeSubtypeSelectElement = containerElement.querySelector(
            "#gdpr-filter-node-subtype",
        ) as HTMLSelectElement;
        this.nodeNameInputElement = containerElement.querySelector("#gdpr-filter-node-name") as HTMLInputElement;
        this.filterDirectionSelectElement = containerElement.querySelector(
            "#gdpr-filter-direction",
        ) as HTMLSelectElement;
        this.searchDepthInputElement = containerElement.querySelector("#gdpr-filter-search-depth") as HTMLInputElement;

        this.nodeTypeSelectElement.options.add(new Option("All", "All"));
        Object.keys(GdprFilterUI.nodeTypes).forEach((nodeType) => {
            this.nodeTypeSelectElement.options.add(new Option(nodeType, nodeType));
        });

        this.nodeTypeSelectElement.addEventListener("change", () => {
            this.updateSubtypeSelect();
            this.runFilter();
        });

        this.nodeSubtypeSelectElement.addEventListener("change", () => this.runFilter());
        this.nodeNameInputElement.addEventListener("keyup", () => this.runFilter());
        this.filterDirectionSelectElement.addEventListener("change", () => this.runFilter());
        this.searchDepthInputElement.addEventListener("change", () => this.runFilter());

        this.updateSubtypeSelect();
    }

    private updateSubtypeSelect(): void {
        // Rebuild the sub type select element based on the selected node type.
        this.nodeSubtypeSelectElement.innerHTML = "";
        this.nodeSubtypeSelectElement.options.add(new Option("All", "All"));
        this.nodeSubtypeSelectElement.options.add(new Option("None", "None"));
        GdprFilterUI.nodeTypes[this.nodeTypeSelectElement.value]?.forEach((nodeSubtype) => {
            this.nodeSubtypeSelectElement.options.add(new Option(nodeSubtype, nodeSubtype));
        });

        // Disable sub type selection when all node types are selected because
        // sub types are unique to each node type and it would not make sense to filter by that.
        this.nodeSubtypeSelectElement.disabled = this.nodeTypeSelectElement.value === "All";
    }

    private async runFilter(): Promise<void> {
        const model = await this.commandStack.executeAll([]);

        // Step 1: Set opacity of all nodes to be not within the filter
        model.children.forEach((element) => {
            if (element instanceof SNodeImpl || element instanceof SEdgeImpl) {
                element.opacity = 0.5;
            }
        });

        // Step 2: Filter nodes and set opacity to 1 for nodes that are within the filter
        model.children.forEach((element) => this.filterNode(element));

        // Toggle re-rendering of the model
        this.commandStack.update(model);
    }

    private filterNode(element: SChildElementImpl | SConnectableElementImpl): void {
        if (!(element instanceof GdprNodeImpl)) {
            if (
                element instanceof SEdgeImpl &&
                this.nodeTypeSelectElement.value === "All" &&
                this.nodeNameInputElement.value === ""
            ) {
                // Special case: all nodes are selected and no node is filtered out
                // => all edges should be fully visible too
                element.opacity = 1;
            }

            // Node must be a gdpr node
            return;
        }

        // Filter node type (if a filter is set)
        if (this.nodeTypeSelectElement.value !== "All") {
            // Construct sprotty type and compare it to the node type
            const t = `node:gdpr-${this.nodeTypeSelectElement.value.toLocaleLowerCase().replace(" ", "")}`;
            if (element.type !== t) {
                // Node type does not match the filter => skip
                return;
            }
        }

        // Filter node direction (if a filter is set)
        if (element instanceof GdprSubTypeNodeImpl && this.nodeSubtypeSelectElement.value !== "All") {
            const subTypeSelection = this.nodeSubtypeSelectElement.value;
            // When subTypeSelection is not "None" then the element sub type must match the filter
            // When subTypeSelection is "None" then the element sub type must be undefined
            if (
                (subTypeSelection !== "None" && element.subType !== subTypeSelection) ||
                (subTypeSelection === "None" && element.subType)
            ) {
                // Node sub type does not match the filter => skip
                return;
            }
        }

        // Filter node direction (if a filter is set)
        if (element.editableLabel?.text) {
            if (!element.editableLabel.text.includes(this.nodeNameInputElement.value)) {
                // Node name filter is not a substring of the node name => skip
                return;
            }
        }

        element.opacity = 1;
        this.traverseNodes(element, parseInt(this.searchDepthInputElement.value));
    }

    private traverseNodes(element: SChildElementImpl | SConnectableElementImpl, remainingDepth: number): boolean {
        if (remainingDepth < 0) {
            // Reached the end of the search depth
            return false;
        }

        if (!(element instanceof SNodeImpl)) {
            // Element must be a node
            return false;
        }

        const direction = this.filterDirectionSelectElement.value;

        if (direction === "both" || direction === "references") {
            // Traverse references
            element.outgoingEdges.forEach((edge) => {
                if (edge.target && this.traverseNodes(edge.target, remainingDepth - 1)) {
                    edge.opacity = 1;
                }
            });
        }

        if (direction === "both" || direction === "referenced") {
            // Traverse referenced nodes
            element.incomingEdges.forEach((edge) => {
                if (edge.source && this.traverseNodes(edge.source, remainingDepth - 1)) {
                    edge.opacity = 1;
                }
            });
        }

        element.opacity = 1;
        return true;
    }

    keyDown(_element: SModelElementImpl, event: KeyboardEvent): Action[] {
        if (matchesKeystroke(event, "KeyF")) {
            const accordionStateElement = document.getElementById(
                "accordion-state-gdpr-filter",
            ) as HTMLInputElement | null;
            if (!accordionStateElement) {
                this.logger.error(this, "Could not find accordion state element");
                return [];
            }
            accordionStateElement.checked = !accordionStateElement.checked;
        }

        return [];
    }

    keyUp(_element: SModelElementImpl, _event: KeyboardEvent): Action[] {
        return []; // ignored
    }
}
