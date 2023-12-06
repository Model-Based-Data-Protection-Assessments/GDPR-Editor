import { ContainerModule } from "inversify";
import { TYPES, configureModelElement, withEditLabelFeature } from "sprotty";

import "./styles.css";
import { GdprProcessingNodeImpl, GdprProcessingNodeView } from "./nodes";
import { GdprEdgeImpl, GdprEdgeView } from "./edges";

export const gdprElementsModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    // DFD label validations that limit the label values for edges are not wanted for GDPR
    // diagrams, as the edge labels do not have any special meaning unlike in DFD diagrams.
    unbind(TYPES.IEditLabelValidator);

    const context = { bind, unbind, isBound, rebind };

    configureModelElement(context, "node:gdpr-processing", GdprProcessingNodeImpl, GdprProcessingNodeView);
    configureModelElement(context, "edge:gdpr", GdprEdgeImpl, GdprEdgeView, {
        enable: [withEditLabelFeature],
    });
});
