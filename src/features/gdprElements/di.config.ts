import { ContainerModule } from "inversify";
import { TYPES, configureModelElement, withEditLabelFeature } from "sprotty";
import { GdprLegalBasisNodeImpl, GdprProcessingNodeImpl, GdprRoleNodeImpl, GdprSubTypeNodeView } from "./nodes";
import { GdprEdgeImpl, GdprEdgeView } from "./edges";

import "./styles.css";

export const gdprElementsModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    // DFD label validations that limit the label values for edges are not wanted for GDPR
    // diagrams, as the edge labels do not have any special meaning unlike in DFD diagrams.
    unbind(TYPES.IEditLabelValidator);

    const context = { bind, unbind, isBound, rebind };

    configureModelElement(context, "node:gdpr-processing", GdprProcessingNodeImpl, GdprSubTypeNodeView);
    configureModelElement(context, "node:gdpr-legalbasis", GdprLegalBasisNodeImpl, GdprSubTypeNodeView);
    configureModelElement(context, "node:gdpr-role", GdprRoleNodeImpl, GdprSubTypeNodeView);

    configureModelElement(context, "edge:gdpr", GdprEdgeImpl, GdprEdgeView, {
        enable: [withEditLabelFeature],
    });
});
