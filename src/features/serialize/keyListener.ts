import { injectable } from "inversify";
import { CommitModelAction, KeyListener, SModelElementImpl } from "sprotty";
import { Action } from "sprotty-protocol";
import { matchesKeystroke } from "sprotty/lib/utils/keyboard";
import { LoadDefaultDiagramAction } from "./loadDefaultDiagram";
import { LoadDiagramAction } from "./load";
import { SaveDiagramAction } from "./save";

@injectable()
export class SerializeKeyListener extends KeyListener {
    keyDown(_element: SModelElementImpl, event: KeyboardEvent): Action[] {
        if (matchesKeystroke(event, "KeyO", "ctrlCmd")) {
            // Prevent the browser file open dialog from opening
            event.preventDefault();

            return [LoadDiagramAction.create(), CommitModelAction.create()];
        } else if (matchesKeystroke(event, "KeyO", "ctrlCmd", "shift")) {
            event.preventDefault();
            return [LoadDefaultDiagramAction.create(), CommitModelAction.create()];
        } else if (matchesKeystroke(event, "KeyS", "ctrlCmd")) {
            event.preventDefault();
            return [SaveDiagramAction.create()];
        }

        return [];
    }
}
