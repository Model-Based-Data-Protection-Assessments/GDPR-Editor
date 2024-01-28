import { AbstractUIExtension, CommandStack, SChildElementImpl, SEdgeImpl, SNodeImpl, TYPES } from "sprotty";
import {
    GdprNodeImpl,
    GdprSubTypeNodeImpl,
    gdprDataTypes,
    gdprLegalBasisTypes,
    gdprProcessingTypes,
    gdprRoleTypes,
} from "./nodes";

import "./filterUi.css";
import { inject } from "inversify";

export class GdprFilterUI extends AbstractUIExtension {
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
                    <p>Node Type: <select id="gdpr-filter-node-type"></select></p>
                    <p>Node Subtype: <select id="gdpr-filter-node-subtype"></select></p>
                    <p>Node Name: <input type="text" id="gdpr-filter-node-name"></p>
                    <p>Direction:
                        <select id="gdpr-filter-direction">
                            <option value="references">References</option>
                            <option value="referenced">Referenced</option>
                            <option value="both">Both</option>
                        </select>
                    </p>
                    <p>Search depth: <input type="number" id="gdpr-filter-search-depth" value="1"></p>
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

    private filterNode(element: SChildElementImpl): void {
        if (!(element instanceof GdprNodeImpl)) {
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
            if (element.subType !== this.nodeSubtypeSelectElement.value) {
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
    }
}
