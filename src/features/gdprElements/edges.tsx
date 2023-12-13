/** @jsx svg */
import { VNode } from "snabbdom";
import { svg, RenderingContext, IViewArgs, SLabelImpl } from "sprotty";
import { Point, SEdge, SLabel, angleOfPoint, toDegrees } from "sprotty-protocol";
import { ArrowEdgeView } from "../dfdElements/edges";
import { GdprNodeImpl } from "./nodes";
import { DynamicChildrenEdge } from "../dfdElements/dynamicChildren";

export interface GdprEdge extends SEdge {}

export class GdprEdgeImpl extends DynamicChildrenEdge {
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
    private determineEdgeLabel(edge: Readonly<GdprEdgeImpl>): string | undefined {
        if (edge.source instanceof GdprNodeImpl && edge.target instanceof GdprNodeImpl) {
            return edge.target.getEdgeLabel(edge.source);
        } else {
            return undefined;
        }
    }
}
