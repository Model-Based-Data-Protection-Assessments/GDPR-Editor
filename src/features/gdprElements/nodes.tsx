/** @jsx svg */
import {
    svg,
    RenderingContext,
    SNodeImpl,
    ShapeView,
    WithEditableLabel,
    isEditableLabel,
    withEditLabelFeature,
    SRoutableElementImpl,
} from "sprotty";
import { Bounds, SLabel, SNode } from "sprotty-protocol";
import { injectable } from "inversify";
import { VNode } from "snabbdom";
import { DynamicChildrenNode } from "../dfdElements/dynamicChildren";
import { calculateTextSize } from "../../utils";
import { DfdPositionalLabelArgs } from "../dfdElements/labels";

export interface GdprNode extends SNode {
    text?: string;
}

export class GdprNodeImpl extends DynamicChildrenNode implements WithEditableLabel {
    static readonly DEFAULT_FEATURES = [...SNodeImpl.DEFAULT_FEATURES, withEditLabelFeature];
    private static readonly LABEL_TYPE = "label:positional";

    protected defaultWidth = 80;
    protected nodeHeight = 30;
    protected nodeWidthPadding = 12;

    text?: string;

    override setChildren(schema: GdprNode): void {
        const children = [
            {
                type: GdprNodeImpl.LABEL_TYPE,
                text: schema.text ?? "",
                id: schema.id + "-label",
            } as SLabel,
        ];

        schema.children = children;
    }

    override removeChildren(schema: GdprNode): void {
        const label = schema.children?.find((element) => element.type === GdprNodeImpl.LABEL_TYPE) as
            | SLabel
            | undefined;

        schema.text = label?.text;
        schema.children = [];
    }

    get editableLabel() {
        const label = this.children.find((element) => element.type === GdprNodeImpl.LABEL_TYPE);
        if (label && isEditableLabel(label)) {
            return label;
        }

        return undefined;
    }

    override get bounds(): Bounds {
        return {
            x: this.position.x,
            y: this.position.y,
            width: this.calculateWidth(),
            height: this.nodeHeight,
        };
    }

    protected calculateWidth(): number {
        if (!this.editableLabel?.text) {
            return this.defaultWidth;
        }
        return calculateTextSize(this.editableLabel?.text).width + this.nodeWidthPadding;
    }
}

const gdprProcessingTypes = ["Collecting", "Storing", "Sharing", "Deleting"] as const;
type GdprProcessingType = (typeof gdprProcessingTypes)[number];

export interface GdprProcessingNode extends GdprNode {
    processingType: GdprProcessingType | undefined;
}

export class GdprProcessingNodeImpl extends GdprNodeImpl {
    processingType: GdprProcessingType | undefined;

    protected nodeHeight = 40;

    canConnect(_routable: SRoutableElementImpl, _role: string): boolean {
        if (this.processingType === undefined) {
            return false;
        }

        return true;
    }

    public getTypeText(): string {
        const pocessingType = this.processingType ?? "No Type specified";
        return `<<Processing | ${pocessingType}>>`;
    }

    protected calculateWidth(): number {
        const superWidth = super.calculateWidth();
        const typeTextWidth = calculateTextSize(this.getTypeText(), "6pt sans-serif").width + this.nodeWidthPadding;

        return Math.max(superWidth, typeTextWidth);
    }
}

@injectable()
export class GdprProcessingNodeView extends ShapeView {
    render(node: Readonly<GdprProcessingNodeImpl>, context: RenderingContext): VNode | undefined {
        if (!this.isVisible(node, context)) {
            return undefined;
        }

        const { width, height } = node.bounds;

        return (
            <g
                class-sprotty-node={true}
                class-gdpr={true}
                class-gdpr-type-missing={node.processingType === undefined}
                style={{ opacity: node.opacity.toString() }}
            >
                <rect x="0" y="0" width={width} height={height} />
                <text x={width / 2} y="8" class-gdpr-type={true}>
                    {node.getTypeText()}
                </text>

                {context.renderChildren(node, {
                    xPosition: width / 2,
                    yPosition: height / 2 + 4,
                } as DfdPositionalLabelArgs)}
            </g>
        );
    }
}
