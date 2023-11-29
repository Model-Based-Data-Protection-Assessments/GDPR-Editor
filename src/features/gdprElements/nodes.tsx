/** @jsx svg */
import {
    svg,
    RenderingContext,
    SNodeImpl,
    ShapeView,
    WithEditableLabel,
    isEditableLabel,
    withEditLabelFeature,
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
    static readonly DEFAULT_WIDTH = 50;
    static readonly WIDTH_PADDING = 12;
    static readonly HEIGHT = 30;
    private static readonly LABEL_TYPE = "label:positional";

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
            height: GdprNodeImpl.HEIGHT,
        };
    }

    private calculateWidth(): number {
        return calculateTextSize(this.editableLabel?.text).width + GdprNodeImpl.WIDTH_PADDING;
    }
}

@injectable()
export class GdprNodeView extends ShapeView {
    render(node: Readonly<GdprNodeImpl>, context: RenderingContext): VNode | undefined {
        if (!this.isVisible(node, context)) {
            return undefined;
        }

        const { width, height } = node.bounds;

        return (
            <g class-sprotty-node={true} class-gdpr={true} style={{ opacity: node.opacity.toString() }}>
                <rect x="0" y="0" width={width} height={height} />
                {context.renderChildren(node, {
                    xPosition: width / 2,
                    yPosition: height / 2,
                } as DfdPositionalLabelArgs)}
            </g>
        );
    }
}
