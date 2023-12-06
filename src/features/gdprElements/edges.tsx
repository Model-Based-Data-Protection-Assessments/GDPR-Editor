/** @jsx svg */
import { VNode } from "snabbdom";
import { svg, RenderingContext } from "sprotty";
import { Point, angleOfPoint, toDegrees } from "sprotty-protocol";
import { ArrowEdge, ArrowEdgeImpl, ArrowEdgeView } from "../dfdElements/edges";

export interface GdprEdge extends ArrowEdge {}

export class GdprEdgeImpl extends ArrowEdgeImpl {}

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
}
