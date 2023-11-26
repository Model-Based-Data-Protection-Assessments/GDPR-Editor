import { ContainerModule } from "inversify";
import { configureModelElement } from "sprotty";
import { GdprNodeImpl, GdprNodeView } from "./nodes";

export const gdprElementsModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    const context = { bind, unbind, isBound, rebind };

    configureModelElement(context, "node:gdpr-entity", GdprNodeImpl, GdprNodeView);
});
