import { ContainerModule } from "inversify";
import { TYPES, configureCommand, configureModelElement, withEditLabelFeature } from "sprotty";
import {
    GdprDataNodeImpl,
    GdprLegalBasisNodeImpl,
    GdprProcessingNodeImpl,
    GdprPurposeNodeImpl,
    GdprPurposeNodeView,
    GdprRoleNodeImpl,
    GdprSubTypeNodeView,
} from "./nodes";
import { ToggleGdprEdgeLabelTextCommand, GdprEdgeToggleLabelMouseListener, GdprEdgeImpl, GdprEdgeView } from "./edges";
import { GdprSubTypeEditUI, GdprSubTypeEditUIMouseListener, SetGdprSubTypeCommand } from "./subTypeEditUI";
import { GdprValidationResultPopupMouseListener, GdprValidationResultPopupUI } from "./validationErrorsPopup";

import "./styles.css";

export const gdprElementsModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    // DFD label validations that limit the label values for edges are not wanted for GDPR
    // diagrams, as the edge labels do not have any special meaning unlike in DFD diagrams.
    unbind(TYPES.IEditLabelValidator);

    const context = { bind, unbind, isBound, rebind };

    bind(GdprSubTypeEditUI).toSelf().inSingletonScope();
    bind(TYPES.IUIExtension).toService(GdprSubTypeEditUI);
    bind(TYPES.MouseListener).to(GdprSubTypeEditUIMouseListener).inSingletonScope();
    configureCommand(context, SetGdprSubTypeCommand);

    configureCommand(context, ToggleGdprEdgeLabelTextCommand);
    bind(TYPES.MouseListener).to(GdprEdgeToggleLabelMouseListener).inSingletonScope();

    bind(GdprValidationResultPopupMouseListener).toSelf().inSingletonScope();
    bind(TYPES.MouseListener).toService(GdprValidationResultPopupMouseListener);
    bind(TYPES.IUIExtension).to(GdprValidationResultPopupUI).inSingletonScope();

    configureModelElement(context, "node:gdpr-processing", GdprProcessingNodeImpl, GdprSubTypeNodeView);
    configureModelElement(context, "node:gdpr-legalbasis", GdprLegalBasisNodeImpl, GdprSubTypeNodeView);
    configureModelElement(context, "node:gdpr-role", GdprRoleNodeImpl, GdprSubTypeNodeView);
    configureModelElement(context, "node:gdpr-data", GdprDataNodeImpl, GdprSubTypeNodeView);
    configureModelElement(context, "node:gdpr-purpose", GdprPurposeNodeImpl, GdprPurposeNodeView);

    configureModelElement(context, "edge:gdpr", GdprEdgeImpl, GdprEdgeView, {
        enable: [withEditLabelFeature],
    });
});
