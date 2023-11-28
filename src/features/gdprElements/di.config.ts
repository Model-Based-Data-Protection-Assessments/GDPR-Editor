import { ContainerModule } from "inversify";
import { configureModelElement, withEditLabelFeature } from "sprotty";
import { GdprNodeImpl, GdprNodeView } from "./nodes";
import { GdprEdgeAssociationView, GdprEdgeGeneralizationView, GdprEdgeImpl } from "./edges";

import "./styles.css";

export const gdprElementsModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    const context = { bind, unbind, isBound, rebind };

    configureModelElement(context, "node:gdpr-entity", GdprNodeImpl, GdprNodeView);
    configureModelElement(context, "edge:gdpr-association", GdprEdgeImpl, GdprEdgeAssociationView, {
        enable: [withEditLabelFeature],
    });
    configureModelElement(context, "edge:gdpr-generalization", GdprEdgeImpl, GdprEdgeGeneralizationView, {
        enable: [withEditLabelFeature],
    });
});
