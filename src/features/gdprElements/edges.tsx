/** @jsx svg */
import { VNode } from "snabbdom";
import {
    svg,
    RenderingContext,
    IViewArgs,
    SLabelImpl,
    Command,
    CommandExecutionContext,
    CommandReturn,
    TYPES,
    MouseListener,
    SModelElementImpl,
} from "sprotty";
import { Action, Point, SEdge, SLabel, angleOfPoint, toDegrees } from "sprotty-protocol";
import { ArrowEdgeView } from "../dfdElements/edges";
import { GdprNodeImpl } from "./nodes";
import { DynamicChildrenEdge } from "../dfdElements/dynamicChildren";
import { inject, injectable } from "inversify";

export interface GdprEdge extends SEdge {
    /**
     * Index of the label that should be displayed on the edge.
     * If the edge has multiple possible labels, this index determines which one is displayed starting from 0.
     * If the edge has only one possible label, this property is undefined.
     * If the edge has no label, this property is undefined.
     */
    labelIndex?: number;
    subtype: "";
}

export class GdprEdgeImpl extends DynamicChildrenEdge {
    labelIndex?: number;
    text: string = "";

    setChildren(schema: SEdge): void {
        schema.children = [
            {
                type: "label:filled-background",
                text: "",
                id: schema.id + "-label",
                edgePlacement: {
                    position: 0.5,
                    side: "on",
                    rotate: false,
                },
            } as SLabel,
        ];
    }

    removeChildren(schema: SEdge): void {
        schema.children = [];
    }

    get label(): SLabelImpl {
        const label = this.children.find((element) => element.type.startsWith("label"));
        if (label && label instanceof SLabelImpl) {
            return label;
        }

        throw new Error("Label not found");
    }
}

export class GdprEdgeView extends ArrowEdgeView {
    protected renderAdditionals(edge: GdprEdgeImpl, segments: Point[], _context: RenderingContext): VNode[] {
        edge.text = this.determineEdgeLabel(edge) ?? "";
        const p1 = segments[segments.length - 2];
        const p2 = segments[segments.length - 1];
        const arrow = (
            <path
                class-arrow-association={true}
                // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d
                d="M 10,-4 L 1.5,0 L 10,4 M 1.5,0 L 10,0"
                transform={`rotate(${toDegrees(angleOfPoint({ x: p1.x - p2.x, y: p1.y - p2.y }))} ${p2.x} ${
                    p2.y
                }) translate(${p2.x} ${p2.y})`}
                style={{ opacity: edge.opacity.toString() }}
            />
        );
        return [arrow];
    }

    override render(edge: Readonly<GdprEdgeImpl>, context: RenderingContext, args?: IViewArgs): VNode | undefined {
        edge.label.text = this.determineEdgeLabel(edge) ?? "";

        return super.render(edge, context, args);
    }

    /**
     * Determines the label that should be displayed on the edge
     * depending on the target and source node.
     * The text is determined by asking the target node for the label, which may
     * depend on the source node.
     *
     * @returns a string if there should be a edge label, undefined otherwise
     */
    protected determineEdgeLabel(edge: GdprEdgeImpl): string | undefined {
        if (edge.source instanceof GdprNodeImpl && edge.target instanceof GdprNodeImpl) {
            const labelText = edge.target.getPossibleEdgeLabels(edge.source);
            if (typeof labelText === "object") {
                // labelText is an array. This means there are multiple possible labels.
                // The user must choose one of through cycling through them by right clicking on the edge.
                // The index of the selected edge label is used in this case.
                const index = (edge.labelIndex ?? 0) % labelText.length;

                // Save real index after modulo operation to make sure stored index is lowest possible index for this value.
                edge.labelIndex = index;

                return labelText[index];
            } else {
                // No selection possible. Just return the single available label text (if any).
                edge.labelIndex = undefined;

                return labelText;
            }
        } else {
            return undefined;
        }
    }
}

export interface ToggleGdprEdgeLabelTextAction extends Action {
    readonly kind: typeof ToggleGdprEdgeLabelTextAction.KIND;
    readonly edgeId: string;
}
export namespace ToggleGdprEdgeLabelTextAction {
    export const KIND = "gdpr-edge-label-toggle-text";

    export function create(edgeId: string): ToggleGdprEdgeLabelTextAction {
        return { kind: KIND, edgeId };
    }
}

/**
 * For GDPR Edges with multiple possible labels, this command cycles forward through the possible labels.
 */
@injectable()
export class ToggleGdprEdgeLabelTextCommand extends Command {
    static readonly KIND = ToggleGdprEdgeLabelTextAction.KIND;

    private edge?: GdprEdgeImpl;
    private previousIndex?: number;
    private newIndex?: number;

    constructor(@inject(TYPES.Action) private readonly action: ToggleGdprEdgeLabelTextAction) {
        super();
    }

    execute(context: CommandExecutionContext): CommandReturn {
        const edge = context.root.index.getById(this.action.edgeId);
        if (edge instanceof GdprEdgeImpl) {
            this.edge = edge;
            this.previousIndex = edge.labelIndex;
            this.previousIndex = this.previousIndex ?? 0;
            this.newIndex = this.previousIndex + 1;
            edge.labelIndex = this.newIndex;
        }

        return context.root;
    }

    undo(context: CommandExecutionContext): CommandReturn {
        if (this.edge) {
            this.edge.labelIndex = this.previousIndex;
        }
        return context.root;
    }

    redo(context: CommandExecutionContext): CommandReturn {
        if (this.edge) {
            this.edge.labelIndex = this.newIndex;
        }
        return context.root;
    }
}

@injectable()
export class GdprEdgeToggleLabelMouseListener extends MouseListener {
    mouseDown(target: SModelElementImpl, event: MouseEvent): (Action | Promise<Action>)[] {
        if (event.button === 2 && target instanceof GdprEdgeImpl) {
            return [ToggleGdprEdgeLabelTextAction.create(target.id)];
        }

        return [];
    }
}
