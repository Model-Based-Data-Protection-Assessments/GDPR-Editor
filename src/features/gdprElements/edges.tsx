/** @jsx svg */
import { VNode } from "snabbdom";
import { svg, RenderingContext, IActionDispatcher, SetUIExtensionVisibilityAction, TYPES } from "sprotty";
import { Point, angleOfPoint, toDegrees } from "sprotty-protocol";
import { ArrowEdge, ArrowEdgeImpl, ArrowEdgeView } from "../dfdElements/edges";
import { calculateTextSize } from "../../utils";
import { EdgeMultiplicityEditUI } from "./edgeMultiplicityEditUI";
import { inject } from "inversify";

export interface GdprEdge extends ArrowEdge {
    multiplicity?: string;
}

export class GdprEdgeImpl extends ArrowEdgeImpl {
    multiplicity?: string;
}

/**
 * Returns the node edge where an incoming edge would connect to the node.
 * @param absAngle the angle of the incoming edge in degrees. Must be in [0, 360] (thus absolute)
 * @returns the edge of the node where the incoming edge would connect to
 */
function getNodeEdgeOfIncomingAngle(absAngle: number): "top" | "right" | "bottom" | "left" {
    if (absAngle > 45 && absAngle < 135) {
        return "bottom";
    } else if (absAngle > 135 && absAngle < 225) {
        return "left";
    } else if (absAngle > 225 && absAngle < 315) {
        return "top";
    } else {
        return "right";
    }
}

/**
 * Determines the position of the multiplicity text of an edge.
 * @param edge the edge to render the multiplicity for
 * @param lastTwoPoints the last two routing points of the edge, used to determine the angle of the edge
 * @returns the center position of the multiplicity text
 */
function determineMultiplicityPosition(edge: GdprEdgeImpl, lastTwoPoints: [Point, Point]): Point {
    const [p1, p2] = lastTwoPoints;
    const angle = angleOfPoint({ x: p1.x - p2.x, y: p1.y - p2.y });
    const angleInDegrees = toDegrees(angle);
    const absAngle = angleInDegrees < 0 ? angleInDegrees + 360 : angleInDegrees;
    const nodeEdge = getNodeEdgeOfIncomingAngle(absAngle);

    const multiplicityPosition = { ...p2 };
    const xOffset = calculateTextSize(edge.multiplicity, "7pt sans-serif").width / 2 + 5;
    const yOffset = 11;

    // For each edge orientation, we first move the multiplicity text from the node outwards
    // using either the x or y direction so it is not ontop of the node. Then we move it
    // from the edge sideways away. E.g. for a top edge we move it to the left or right
    // to the edge, depending on the angle.
    switch (nodeEdge) {
        case "top":
            multiplicityPosition.y -= yOffset;
            if (absAngle >= 270) {
                multiplicityPosition.x -= xOffset;
            } else {
                multiplicityPosition.x += xOffset;
            }
            break;
        case "right":
            multiplicityPosition.x += xOffset;
            if (absAngle >= 90) {
                multiplicityPosition.y += yOffset;
            } else {
                multiplicityPosition.y -= yOffset;
            }
            break;
        case "bottom":
            multiplicityPosition.y += yOffset;
            if (absAngle >= 90) {
                multiplicityPosition.x += xOffset;
            } else {
                multiplicityPosition.x -= xOffset;
            }
            break;
        case "left":
            multiplicityPosition.x -= xOffset;
            if (absAngle >= 180) {
                multiplicityPosition.y += yOffset;
            } else {
                multiplicityPosition.y -= yOffset;
            }
            break;
    }

    return multiplicityPosition;
}

/**
 * Renders the multiplicity text of an edge.
 * Resulting VNode can be rendered inside the edge view by returning it as an additional element.
 * @param edge the edge to render the multiplicity for
 * @param lastTwoPoints the last two routing points of the edge, used to determine the angle of the edge
 * @returns a svg text element if the multiplicity is set, undefined otherwise
 */
function renderMultiplicity(edge: GdprEdgeImpl, lastTwoPoints: [Point, Point]): VNode | undefined {
    if (!edge.multiplicity) {
        return undefined;
    }

    const multiplicityPosition = determineMultiplicityPosition(edge, lastTwoPoints);
    return (
        <text
            class-multiplicity={true}
            text-anchor="middle"
            transform={`translate(${multiplicityPosition.x} ${multiplicityPosition.y})`}
        >
            {edge.multiplicity}
        </text>
    );
}

function showEdgeMultiplicityEditUI(
    dispatcher: IActionDispatcher,
    ui: EdgeMultiplicityEditUI,
    edge: GdprEdgeImpl,
    lastTwoPoints: [Point, Point],
): void {
    const multiplicityPosition = determineMultiplicityPosition(edge, lastTwoPoints);

    ui.setEdge(edge, multiplicityPosition);
    dispatcher.dispatch(
        SetUIExtensionVisibilityAction.create({
            extensionId: ui.id(),
            visible: true,
        }),
    );
}

export class GdprEdgeAssociationView extends ArrowEdgeView {
    constructor(
        @inject(TYPES.IActionDispatcher) private actionDispatcher: IActionDispatcher,
        @inject(EdgeMultiplicityEditUI) private ui: EdgeMultiplicityEditUI,
    ) {
        super();
    }

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
                on={{ mousedown: (_e) => showEdgeMultiplicityEditUI(this.actionDispatcher, this.ui, edge, [p1, p2]) }}
            />
        );
        return [arrow, renderMultiplicity(edge, [p1, p2])];
    }
}

export class GdprEdgeGeneralizationView extends ArrowEdgeView {
    constructor(
        @inject(TYPES.IActionDispatcher) private actionDispatcher: IActionDispatcher,
        @inject(EdgeMultiplicityEditUI) private ui: EdgeMultiplicityEditUI,
    ) {
        super();
    }

    protected renderAdditionals(edge: GdprEdgeImpl, segments: Point[], _context: RenderingContext): VNode[] {
        const p1 = segments[segments.length - 2];
        const p2 = segments[segments.length - 1];

        const arrow = (
            <path
                class-arrow-generalization={true}
                d="M 1.5,0 L 10,-4 L 10,4 Z"
                transform={`rotate(${toDegrees(angleOfPoint({ x: p1.x - p2.x, y: p1.y - p2.y }))} ${p2.x} ${
                    p2.y
                }) translate(${p2.x} ${p2.y})`}
                style={{ opacity: edge.opacity.toString() }}
                on={{ mousedown: (_e) => showEdgeMultiplicityEditUI(this.actionDispatcher, this.ui, edge, [p1, p2]) }}
            />
        );
        return [arrow, renderMultiplicity(edge, [p1, p2])];
    }
}
