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

export abstract class GdprNodeImpl extends DynamicChildrenNode implements WithEditableLabel {
    static readonly DEFAULT_FEATURES = [...SNodeImpl.DEFAULT_FEATURES, withEditLabelFeature];
    private static readonly LABEL_TYPE = "label:positional";

    protected defaultWidth = 80;
    protected nodeHeight = 40;
    protected nodeWidthPadding = 12;

    text?: string;

    public abstract getEdgeLabel(sourceNode: GdprNodeImpl): string | undefined;

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
    public override getEdgeLabel(sourceNode: GdprNodeImpl): string | undefined {
        if (sourceNode instanceof GdprProcessingNodeImpl) {
            return "following\nprocessing";
        } else if (sourceNode instanceof GdprDataNodeImpl) {
            return "in";
        }

        return undefined;
    }

    public override getBaseTypeText(): string {
        return "Processing";
    }

    public override getPossibleSubTypes(): GdprProcessingType[] {
        return [...gdprProcessingTypes];
    }

    public override canConnect(routable: SRoutableElementImpl, role: string): boolean {
        if (this.subType === undefined) {
            return false;
        }

        if (role === "source") {
            return true;
        } else {
            return routable.source instanceof GdprProcessingNodeImpl || routable.source instanceof GdprDataNodeImpl;
        }
    }
}

const gdprLegalBasisTypes = ["Public Authority", "Consent", "Contract"];
type GdprLegalBasisType = (typeof gdprLegalBasisTypes)[number];

export interface GdprLegalBasisNode extends GdprSubTypeNode<GdprLegalBasisType> {}

export class GdprLegalBasisNodeImpl extends GdprSubTypeNodeImpl<GdprLegalBasisType> {
    public override getEdgeLabel(sourceNode: GdprNodeImpl): string | undefined {
        if (sourceNode instanceof GdprProcessingNodeImpl) {
            return "on\nbasis\nof";
        }
    }

    public override getBaseTypeText(): string {
        return "Legal Basis";
    }

    public override getPossibleSubTypes(): GdprLegalBasisType[] {
        return [...gdprLegalBasisTypes];
    }

    public override canConnect(routable: SRoutableElementImpl, role: string): boolean {
        if (this.subType === undefined) {
            return false;
        }

        if (role === "source") {
            if (this.subType === "Consent" || this.subType === "Contract") {
                return true;
            }

            let outgoingEdges = 0;
            this.outgoingEdges.forEach((_edge) => outgoingEdges++);
            return outgoingEdges === 0;
        } else {
            return routable.source instanceof GdprProcessingNodeImpl;
        }
    }
}

const gdprRoleTypes = ["Natural Person", "Third Party", "Controller"];
type GdprRoleType = (typeof gdprRoleTypes)[number];

export interface GdprRoleNode extends GdprSubTypeNode<GdprRoleType> {}

export class GdprRoleNodeImpl extends GdprSubTypeNodeImpl<GdprRoleType> {
    public override getEdgeLabel(sourceNode: GdprNodeImpl): string | undefined {
        if (this.subType === "Natural Person") {
            if (sourceNode instanceof GdprLegalBasisNodeImpl && sourceNode.subType === "Consent") {
                return "consentee";
            } else if (sourceNode instanceof GdprDataNodeImpl && sourceNode.subType === "Personal Data") {
                return "references";
            }
        }

        return undefined;
    }

    public override getBaseTypeText(): string {
        return "Role";
    }

    public override getPossibleSubTypes(): GdprRoleType[] {
        return [...gdprRoleTypes];
    }

    public override canConnect(routable: SRoutableElementImpl, role: string): boolean {
        if (this.subType === undefined) {
            return false;
        }

        if (role === "source") {
            return false;
        } else {
            if (
                this.subType === "Natural Person" &&
                routable.source instanceof GdprDataNodeImpl &&
                routable.source.subType === "Personal Data"
            ) {
                return true;
            }

            if (!(routable.source instanceof GdprLegalBasisNodeImpl)) {
                return false;
            }

            let natPersonConsenteeCount = 0;
            this.incomingEdges
                .filter((edge) => edge.source instanceof GdprLegalBasisNodeImpl && edge.source.subType === "Consent")
                .forEach((_edge) => natPersonConsenteeCount++);
            if (
                this.subType === "Natural Person" &&
                routable.source.subType === "Consent" &&
                natPersonConsenteeCount === 0
            ) {
                return true;
            }

            return routable.source.subType === "Contract";
        }
    }
}

const gdprDataTypes = ["Personal Data"];
type GdprDataType = (typeof gdprDataTypes)[number];

export interface GdprDataNode extends GdprSubTypeNode<GdprDataType> {}

export class GdprDataNodeImpl extends GdprSubTypeNodeImpl<GdprDataType> {
    public override getEdgeLabel(sourceNode: GdprNodeImpl): string | undefined {
        if (sourceNode instanceof GdprLegalBasisNodeImpl) {
            return "defined data";
        } else if (sourceNode instanceof GdprProcessingNodeImpl) {
            return "out";
        }

        return undefined;
    }

    public override getBaseTypeText(): string {
        return "Data";
    }

    public override getPossibleSubTypes(): GdprDataType[] {
        return [...gdprDataTypes];
    }

    public override canConnect(routable: SRoutableElementImpl, role: string): boolean {
        if (this.subType === undefined) {
            return false;
        }

        if (role === "source") {
            return true;
        } else {
            if (routable.source instanceof GdprProcessingNodeImpl) {
                return true;
            }

            if (routable.source instanceof GdprLegalBasisNodeImpl) {
                let legalBasisDataCount = 0;
                routable.source.outgoingEdges
                    .filter((edge) => edge.target instanceof GdprDataNodeImpl)
                    .forEach((_edge) => legalBasisDataCount++);

                return legalBasisDataCount === 0;
            }

            return false;
        }
    }
}

export interface GdprPurposeNode extends GdprNode {}

export class GdprPurposeNodeImpl extends GdprNodeImpl {
    public override getEdgeLabel(_sourceNode: GdprNodeImpl): string | undefined {
        return undefined; // no edge labels at all
    }

    protected override calculateWidth(): number {
        return Math.max(super.calculateWidth(), 60);
    }

    public override canConnect(routable: SRoutableElementImpl, role: string): boolean {
        if (role === "source") {
            return false;
        } else {
            if (routable.source instanceof GdprProcessingNodeImpl) {
                return true;
            }

            if (routable.source instanceof GdprLegalBasisNodeImpl && routable.source.subType === "Consent") {
                return true;
            }

            return false;
        }
    }
}

export class GdprPurposeNodeView extends ShapeView {
    render(node: Readonly<GdprPurposeNodeImpl>, context: RenderingContext): VNode | undefined {
        if (!this.isVisible(node, context)) {
            return undefined;
        }

        const { width, height } = node.bounds;

        return (
            <g class-sprotty-node={true} class-gdpr={true} style={{ opacity: node.opacity.toString() }}>
                <rect x="0" y="0" width={width} height={height} />
                <text x={width / 2} y="8" class-gdpr-type={true}>
                    {`<<Purpose>>`}
                </text>

                {context.renderChildren(node, {
                    xPosition: width / 2,
                    yPosition: height / 2 + 4,
                } as DfdPositionalLabelArgs)}
            </g>
        );
    }
}
