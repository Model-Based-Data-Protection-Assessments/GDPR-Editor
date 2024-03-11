# Technical documentation

This project is a fork from the [DataFlowAnalysis WebEditor](https://github.com/DataFlowAnalysis/WebEditor).
The codebase is mostly shared with some changes.
These changes are detailed in this document.
Please refer to the [DFD Web Editor documentation](https://github.com/DataFlowAnalysis/WebEditor) for more information about the original project,
how it is structured, how the base module work, etc.

## Modules

Gives an overview of which modules are changed compared to the DFD Web Editor
and what the new GDPR module does.

### Common module

The help UI has been updated with help details for the GDPR elements
and the DFD specific help entries have been removed.

### DFD Label Module

This module is the only DFD module that is not loaded in this project.
The label edit ui is not wanted in this project, so the module is not loaded.
Also it would collide with the search function UI.

### Tool Palette

The tool palette has been changed to contain the GDPR elements provided by the GDPR elements module
instead of the original DFD elements.

### GDPR Module

Located in `src/features/gdprElements/`.

Contains everything for the GDPR editor.
This includes the GDPR elements, validation logic and a filter UI for those elements.

#### Elements

Adds the following diagram nodes:

-   Processing
-   Legal Basis
-   Role
-   Data
-   Purpose

All of these elements except for the `Purpose` node have sub types.
These influence what edge connections can be made between the nodes
and the validation rules for correct diagrams.
When placing a node it starts with not having a sub type.
One can change the sub type by right clicking the node and selecting the sub type from the select popup.
The sub type can only be changed when the node has no edges connected to it,
as changing the sub type while remaining edges may break the edge connection rules.

This module also adds a custom edge type.
This edge dynamically sets the edge label depending on the source and target node.
The edge label is not manually editable.

#### Validation

For all nodes there are constraints on needed connections to other nodes
for them to be valid.
All node implementation classes have the validation logic for the corresponding node.
When a node is invalid it is highlighted in red and the validation messages are shown
inside a popup when hovering over the node.

#### Filter UI

GDPR diagrams might get big and complex, so a filter UI has been added to the GDPR module.

The filter UI allows selecting nodes by type, sub type and node label.
Additionally it allows for also selecting nodes that are or get referenced by the nodes
that are selected by the filter with a specified search depth.

Nodes matching the filter condition are displayed as normal while
non matching nodes are displayed with a reduced opacity.
