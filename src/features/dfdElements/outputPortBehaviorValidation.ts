import { inject, injectable, optional } from "inversify";
import { LabelTypeRegistry } from "../labels/labelTypeRegistry";
import { DfdNodeImpl } from "./nodes";
import { DfdOutputPortImpl } from "./ports";

/**
 * Validation error for a single line of the behavior text of a dfd output port.
 */
interface PortBehaviorValidationError {
    message: string;
    // line and column numbers start at 0!
    line: number;
    colStart?: number;
    colEnd?: number;
}

/**
 * Validates the behavior text of a dfd output port (DfdOutputPortImpl).
 * Used inside the OutputPortEditUI.
 */
@injectable()
export class PortBehaviorValidator {
    // Regex that validates a set statement.
    // Has the label type and label value that should be set as capturing groups.
    private static readonly SET_REGEX =
        /^set +([A-z][A-z0-9-]*)\.([A-z][A-z0-9-]*) *= *(?: +|!|TRUE|FALSE|\|\||&&|\(|\)|[A-z][A-z0-9-]*(?:\.[A-z][A-z0-9-]*){2})+$/;
    // Regex that is used to extract all inputs, their label types and label values from a set statement.
    // Each input is a match with the input name, label type and label value as capturing groups.
    private static readonly SET_REGEX_EXPRESSION_INPUTS = /([A-z][A-z0-9]*)\.([A-z][A-z0-9]*)\.([A-z][A-z0-9]*)/g;
    // Regex matching alphanumeric characters.
    public static readonly REGEX_ALPHANUMERIC = /[A-z0-9]+/;

    constructor(@inject(LabelTypeRegistry) @optional() private readonly labelTypeRegistry?: LabelTypeRegistry) {}

    /**
     * validates the whole behavior text of a port.
     * @param behaviorText the behavior text to validate
     * @param port the port that the behavior text should be tested against (relevant for available inputs)
     * @returns errors, if everything is fine the array is empty
     */
    validate(behaviorText: string, port: DfdOutputPortImpl): PortBehaviorValidationError[] {
        const lines = behaviorText.split("\n");
        const errors: PortBehaviorValidationError[] = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineErrors = this.validateLine(line, i, port);
            if (lineErrors) {
                const errorsCols = lineErrors.map((error) => {
                    // Set cols to start/end of line if not set.
                    error.colEnd ??= line.length;
                    error.colStart ??= 0;

                    return error;
                });

                errors.push(...errorsCols);
            }
        }

        return errors;
    }

    /**
     * Validates a single line and returns an error message if the line is invalid.
     * Otherwise returns undefined.
     */
    private validateLine(
        line: string,
        lineNumber: number,
        port: DfdOutputPortImpl,
    ): PortBehaviorValidationError[] | undefined {
        if (line === "" || line.startsWith("#") || line.startsWith("//")) {
            return;
        }

        if (line.startsWith("forward")) {
            return this.validateForwardStatement(line, lineNumber, port);
        }

        if (line.startsWith("set")) {
            return this.validateSetStatement(line, lineNumber, port);
        }

        return [
            {
                line: lineNumber,
                message: "Unknown statement",
            },
        ];
    }

    private validateForwardStatement(
        line: string,
        lineNumber: number,
        port: DfdOutputPortImpl,
    ): PortBehaviorValidationError[] | undefined {
        const inputsString = line.replace("forward", "");
        const inputs = inputsString.split(",").map((input) => input.trim());
        if (inputs.filter((input) => input !== "").length === 0) {
            return [
                {
                    line: lineNumber,
                    message: "forward needs at least one input",
                },
            ];
        }

        const emptyInput = inputs.findIndex((input) => input === "");
        if (emptyInput !== -1) {
            // Find position of empty input given the index of the empty input.
            let emptyInputPosition = line.indexOf(",");
            for (let i = 1; i < emptyInput; i++) {
                emptyInputPosition = line.indexOf(",", emptyInputPosition + 1);
            }

            return [
                {
                    line: lineNumber,
                    message: "trailing comma without being followed by an input",
                    colStart: emptyInputPosition,
                    colEnd: emptyInputPosition + 1,
                },
            ];
        }

        const duplicateInputs = inputs.filter((input) => inputs.filter((i) => i === input).length > 1);
        if (duplicateInputs.length > 0) {
            const distinctDuplicateInputs = [...new Set(duplicateInputs)];

            return distinctDuplicateInputs.flatMap((input) => {
                // find all occurrences of the duplicate input
                const indices = [];
                let idx = line.indexOf(input);
                while (idx !== -1) {
                    // Ensure this is not a substring of another input by
                    // ensuring the character before and after the input are not alphanumeric.
                    // E.g. Input "te" should not detect input "test" as a duplicate of "te".
                    if (
                        !line[idx - 1]?.match(PortBehaviorValidator.REGEX_ALPHANUMERIC) &&
                        !line[idx + input.length]?.match(PortBehaviorValidator.REGEX_ALPHANUMERIC)
                    ) {
                        indices.push(idx);
                    }

                    idx = line.indexOf(input, idx + 1);
                }

                // Create an error for each occurrence of the duplicate input
                return indices.map((index) => ({
                    line: lineNumber,
                    message: `duplicate input: ${input}`,
                    colStart: index,
                    colEnd: index + input.length,
                }));
            });
        }

        const node = port.parent;
        if (!(node instanceof DfdNodeImpl)) {
            throw new Error("Expected port parent to be a DfdNodeImpl.");
        }

        const availableInputs = node.getAvailableInputs();

        const unavailableInputs = inputs.filter((input) => !availableInputs.includes(input));
        if (unavailableInputs.length > 0) {
            return unavailableInputs.map((input) => {
                let foundCorrectInput = false;
                let idx = line.indexOf(input);
                while (!foundCorrectInput) {
                    // Ensure this is not a substring of another input.
                    // Same as above.
                    foundCorrectInput =
                        !line[idx - 1]?.match(PortBehaviorValidator.REGEX_ALPHANUMERIC) &&
                        !line[idx + input.length]?.match(PortBehaviorValidator.REGEX_ALPHANUMERIC);

                    if (!foundCorrectInput) {
                        idx = line.indexOf(input, idx + 1);
                    }
                }

                return {
                    line: lineNumber,
                    message: `invalid/unknown input: ${input}`,
                    colStart: idx,
                    colEnd: idx + input.length,
                };
            });
        }

        return undefined;
    }

    private validateSetStatement(
        line: string,
        lineNumber: number,
        port: DfdOutputPortImpl,
    ): PortBehaviorValidationError[] | undefined {
        const match = line.match(PortBehaviorValidator.SET_REGEX);
        if (!match) {
            return [
                {
                    line: lineNumber,
                    message: "invalid set statement",
                },
            ];
        }

        // Check that the label type and value that this statement tries to set are valid.
        const setLabelType = match[1];
        const setLabelValue = match[2];
        const labelType = this.labelTypeRegistry?.getLabelTypes().find((type) => type.name === setLabelType);
        if (!labelType) {
            return [
                {
                    line: lineNumber,
                    message: `unknown label type: ${setLabelType}`,
                    colStart: line.indexOf(setLabelType),
                    colEnd: line.indexOf(setLabelType) + setLabelType.length,
                },
            ];
        }
        if (!labelType.values.find((value) => value.text === setLabelValue)) {
            return [
                {
                    line: lineNumber,
                    message: `unknown label value of label type ${setLabelType}: ${setLabelValue}`,
                    colStart: line.indexOf(setLabelValue),
                    colEnd: line.indexOf(setLabelValue) + setLabelValue.length,
                },
            ];
        }

        // Parenthesis must be balanced.
        let parenthesisLevel = 0;
        for (let strIdx = 0; strIdx < line.length; strIdx++) {
            const char = line[strIdx];
            if (char === "(") {
                parenthesisLevel++;
            } else if (char === ")") {
                parenthesisLevel--;
            }

            if (parenthesisLevel < 0) {
                return [
                    {
                        line: lineNumber,
                        message: "invalid set statement: missing opening parenthesis",
                        colStart: strIdx,
                        colEnd: strIdx + 1,
                    },
                ];
            }
        }

        if (parenthesisLevel !== 0) {
            return [
                {
                    line: lineNumber,
                    message: "invalid set statement: missing closing parenthesis",
                },
            ];
        }

        // Extract all used inputs, label types and the corresponding label values.
        const expression = line.split("=")[1].trim(); // get everything after the =
        if (expression.length === 0) {
            return [
                {
                    line: lineNumber,
                    message: "invalid set statement: missing expression",
                },
            ];
        }

        const matches = [...expression.matchAll(PortBehaviorValidator.SET_REGEX_EXPRESSION_INPUTS)];

        const node = port.parent;
        if (!(node instanceof DfdNodeImpl)) {
            throw new Error("Expected port parent to be a DfdNodeImpl.");
        }
        const availableInputs = node.getAvailableInputs();

        // Check for each input access that the input exists and that the label type and value are valid.
        const inputAccessErrors = [];
        for (const inputMatch of matches) {
            const inputName = inputMatch[1];
            const inputLabelType = inputMatch[2];
            const inputLabelValue = inputMatch[3];

            if (!availableInputs.includes(inputName)) {
                // Find all occurrences of the unavailable input.
                let idx = line.indexOf(inputName);
                while (idx !== -1) {
                    // Check that this is not a substring of another input.
                    if (
                        // before must not be alphanumeric => start of this string must be the beginning of the input name
                        line[idx - 1]?.match(PortBehaviorValidator.REGEX_ALPHANUMERIC) &&
                        line[idx + inputName.length] === "." // must be followed by a dot to access the label type of the input
                    ) {
                        inputAccessErrors.push({
                            line: lineNumber,
                            message: `invalid/unknown input: ${inputName}`,
                            colStart: idx,
                            colEnd: idx + inputName.length,
                        });
                    }

                    idx = line.indexOf(inputName, idx + 1);
                }

                continue;
            }

            const inputLabelTypeObject = this.labelTypeRegistry
                ?.getLabelTypes()
                .find((type) => type.name === inputLabelType);
            if (!inputLabelTypeObject) {
                let idx = line.indexOf(inputLabelType);
                while (idx !== -1) {
                    // Check that this is not a substring of another label type.
                    if (
                        // must start after a dot and end before a dot
                        line[idx - 1] === "." &&
                        line[idx + inputLabelType.length] === "."
                    ) {
                        inputAccessErrors.push({
                            line: lineNumber,
                            message: `unknown label type: ${inputLabelType}`,
                            colStart: idx,
                            colEnd: idx + inputLabelType.length,
                        });
                    }

                    idx = line.indexOf(inputLabelType, idx + 1);
                }
            } else if (!inputLabelTypeObject.values.find((value) => value.text === inputLabelValue)) {
                let idx = line.indexOf(inputLabelValue);
                while (idx !== -1) {
                    // Check that this is not a substring of another label value.
                    if (
                        // must start after a dot and end at the end of the alphanumeric text
                        line[idx - 1] === "." &&
                        // Might be at the end of the line
                        (!line[idx + inputLabelValue.length] ||
                            !line[idx + inputLabelValue.length].match(PortBehaviorValidator.REGEX_ALPHANUMERIC))
                    ) {
                        inputAccessErrors.push({
                            line: lineNumber,
                            message: `unknown label value of label type ${inputLabelType}: ${inputLabelValue}`,
                            colStart: idx,
                            colEnd: idx + inputLabelValue.length,
                        });
                    }

                    idx = line.indexOf(inputLabelValue, idx + 1);
                }
            }
        }

        return inputAccessErrors.length > 0 ? inputAccessErrors : undefined;
    }
}
