import { inject, injectable } from "inversify";
import {
    CommandExecutionContext,
    CommandReturn,
    DeleteElementCommand,
    EditLabelMouseListener,
    MoveCommand,
    SModelElementImpl,
    SModelRootImpl,
} from "sprotty";
import { EditorModeController } from "./editorModeController";
import { Action } from "sprotty-protocol";

@injectable()
export class EditorModeAwareEditLabelMouseListener extends EditLabelMouseListener {
    constructor(
        @inject(EditorModeController)
        private readonly editorModeController: EditorModeController,
    ) {
        super();
    }

    doubleClick(target: SModelElementImpl, event: MouseEvent): (Action | Promise<Action>)[] {
        if (this.editorModeController.isReadOnly()) {
            return [];
        }

        return super.doubleClick(target, event);
    }
}

@injectable()
export class EditorModeAwareMoveCommand extends MoveCommand {
    @inject(EditorModeController)
    private readonly editorModeController?: EditorModeController;

    execute(context: CommandExecutionContext): CommandReturn {
        if (this.editorModeController?.isReadOnly()) {
            return context.root;
        }

        return super.execute(context);
    }

    undo(context: CommandExecutionContext): Promise<SModelRootImpl> {
        if (this.editorModeController?.isReadOnly()) {
            return Promise.resolve(context.root);
        }

        return super.undo(context);
    }

    redo(context: CommandExecutionContext): Promise<SModelRootImpl> {
        if (this.editorModeController?.isReadOnly()) {
            return Promise.resolve(context.root);
        }

        return super.redo(context);
    }
}

@injectable()
export class EditorModeAwareDeleteElementCommand extends DeleteElementCommand {
    @inject(EditorModeController)
    private readonly editorModeController?: EditorModeController;

    execute(context: CommandExecutionContext): CommandReturn {
        if (this.editorModeController?.isReadOnly()) {
            return context.root;
        }

        return super.execute(context);
    }

    undo(context: CommandExecutionContext): CommandReturn {
        if (this.editorModeController?.isReadOnly()) {
            return context.root;
        }

        return super.undo(context);
    }

    redo(context: CommandExecutionContext): CommandReturn {
        if (this.editorModeController?.isReadOnly()) {
            return context.root;
        }

        return super.redo(context);
    }
}
