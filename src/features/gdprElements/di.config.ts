import { ContainerModule } from "inversify";
import { TYPES, configureModelElement, withEditLabelFeature } from "sprotty";
import { GdprNodeImpl, GdprNodeView } from "./nodes";
import { GdprEdgeAssociationView, GdprEdgeGeneralizationView, GdprEdgeImpl } from "./edges";

import "./styles.css";

export const gdprElementsModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    // DFD label validations that limit the label values for edges are not wanted for GDPR
    // diagrams, as the edge labels do not have any special meaning unlike in DFD diagrams.
    unbind(TYPES.IEditLabelValidator);

    const context = { bind, unbind, isBound, rebind };

    configureModelElement(context, "node:gdpr-entity", GdprNodeImpl, GdprNodeView);
    configureModelElement(context, "edge:gdpr-association", GdprEdgeImpl, GdprEdgeAssociationView, {
        enable: [withEditLabelFeature],
    });
    configureModelElement(context, "edge:gdpr-generalization", GdprEdgeImpl, GdprEdgeGeneralizationView, {
        enable: [withEditLabelFeature],
    });
});
