import { ContainerModule } from "inversify";
import {
    SGraphImpl,
    SGraphView,
    SLabelImpl,
    SRoutingHandleView,
    configureModelElement,
    editLabelFeature,
    withEditLabelFeature,
    SLabelView,
    SRoutingHandleImpl,
} from "sprotty";
import {
    FunctionNodeImpl,
    FunctionNodeView,
    IONodeImpl,
    IONodeView,
    StorageNodeImpl,
    StorageNodeView,
} from "./nodes";
import { ArrowEdgeImpl, ArrowEdgeView } from "./edges";
import { FilledBackgroundLabelView, DfdPositionalLabelView } from "./labels";

import "./styles.css";

export const dfdElementsModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    const context = { bind, unbind, isBound, rebind };
    configureModelElement(context, "graph", SGraphImpl, SGraphView);
    configureModelElement(context, "node:storage", StorageNodeImpl, StorageNodeView);
    configureModelElement(context, "node:function", FunctionNodeImpl, FunctionNodeView);
    configureModelElement(context, "node:input-output", IONodeImpl, IONodeView);
    configureModelElement(context, "edge:arrow", ArrowEdgeImpl, ArrowEdgeView, {
        enable: [withEditLabelFeature],
    });
    configureModelElement(context, "label", SLabelImpl, SLabelView, {
        enable: [editLabelFeature],
    });
    configureModelElement(context, "label:filled-background", SLabelImpl, FilledBackgroundLabelView, {
        enable: [editLabelFeature],
    });
    configureModelElement(context, "label:positional", SLabelImpl, DfdPositionalLabelView, {
        enable: [editLabelFeature],
    });
    configureModelElement(context, "routing-point", SRoutingHandleImpl, SRoutingHandleView);
    configureModelElement(context, "volatile-routing-point", SRoutingHandleImpl, SRoutingHandleView);
});
