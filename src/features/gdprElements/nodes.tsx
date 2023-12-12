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
    protected nodeHeight = 40;
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

export interface GdprSubTypeNode<T extends string> extends GdprNode {
    subType: T | undefined;
}

export abstract class GdprSubTypeNodeImpl<T extends string> extends GdprNodeImpl {
    subType: T | undefined;

    public abstract getPossibleSubTypes(): T[];

    public abstract getBaseTypeText(): string;

    public getTypeText(): string {
        const baseType = this.getBaseTypeText();
        const subType = this.subType ?? "No Type specified";
        return `<<${baseType} | ${subType}>>`;
    }

    public canChangeSubType(): string | true {
        if (!this.subType) {
            // When no sub type is set, we can always change it
            return true;
        }

        // When a sub type is set, we can only change it if there are no edges
        // connected to this node.
        let edgeCount = 0;
        this.incomingEdges.forEach((_edge) => edgeCount++);
        this.outgoingEdges.forEach((_edge) => edgeCount++);

        if (edgeCount > 0) {
            return "Node Sub Type is not changeable because the node has edges connected to it.";
        } else {
            return true;
        }
    }

    protected override calculateWidth(): number {
        const superWidth = super.calculateWidth();
        const typeTextWidth = calculateTextSize(this.getTypeText(), "6pt sans-serif").width + this.nodeWidthPadding;

        return Math.max(superWidth, typeTextWidth);
    }
}

@injectable()
export class GdprSubTypeNodeView extends ShapeView {
    render(node: Readonly<GdprSubTypeNodeImpl<string>>, context: RenderingContext): VNode | undefined {
        if (!this.isVisible(node, context)) {
            return undefined;
        }

        const { width, height } = node.bounds;

        return (
            <g
                class-sprotty-node={true}
                class-gdpr={true}
                class-gdpr-type-missing={node.subType === undefined}
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

const gdprProcessingTypes = ["Collecting", "Usage", "Transferring", "Storage"] as const;
type GdprProcessingType = (typeof gdprProcessingTypes)[number];

export interface GdprProcessingNode extends GdprSubTypeNode<GdprProcessingType> {}

export class GdprProcessingNodeImpl extends GdprSubTypeNodeImpl<GdprProcessingType> {
    public override getBaseTypeText(): string {
        return "Processing";
    }

    public override getPossibleSubTypes(): GdprProcessingType[] {
        return [...gdprProcessingTypes];
    }

    canConnect(_routable: SRoutableElementImpl, _role: string): boolean {
        if (this.subType === undefined) {
            return false;
        }

        return true;
    }
}

const gdprLegalBasisTypes = ["Public Authority", "Consent", "Contract"];
type GdprLegalBasisType = (typeof gdprLegalBasisTypes)[number];

export interface GdprLegalBasisNode extends GdprSubTypeNode<GdprLegalBasisType> {}

export class GdprLegalBasisNodeImpl extends GdprSubTypeNodeImpl<GdprLegalBasisType> {
    public override getBaseTypeText(): string {
        return "Legal Basis";
    }

    public override getPossibleSubTypes(): GdprLegalBasisType[] {
        return [...gdprLegalBasisTypes];
    }

    canConnect(_routable: SRoutableElementImpl, _role: string): boolean {
        if (this.subType === undefined) {
            return false;
        }

        return true;
    }
}

const gdprRoleTypes = ["Natural Person", "Third Party", "Controller"];
type GdprRoleType = (typeof gdprRoleTypes)[number];

export interface GdprRoleNode extends GdprSubTypeNode<GdprRoleType> {}

export class GdprRoleNodeImpl extends GdprSubTypeNodeImpl<GdprRoleType> {
    public override getBaseTypeText(): string {
        return "Role";
    }

    public override getPossibleSubTypes(): GdprRoleType[] {
        return [...gdprRoleTypes];
    }

    canConnect(_routable: SRoutableElementImpl, _role: string): boolean {
        if (this.subType === undefined) {
            return false;
        }

        return true;
    }
}
