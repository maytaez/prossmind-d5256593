/**
 * DMN XML validation utilities
 */

/**
 * Validate DMN 1.3 XML structure
 */
export function validateDmnXml(xmlString: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "application/xml");

    // Check for parser errors
    const parserErrors = doc.getElementsByTagName("parsererror");
    if (parserErrors.length > 0) {
      errors.push("XML parsing failed: Invalid XML structure");
      return { valid: false, errors };
    }

    // Check for root definitions element
    const definitions = doc.querySelector("definitions");
    if (!definitions) {
      errors.push("Missing root <definitions> element");
    } else {
      // Check namespace
      const namespace = definitions.getAttribute("xmlns");
      if (!namespace || !namespace.includes("DMN")) {
        errors.push("Invalid or missing DMN namespace");
      }
    }

    // Check for at least one decision
    const decisions = doc.querySelectorAll("decision");
    if (decisions.length === 0) {
      errors.push("No decision elements found");
    }

    // Validate decision tables
    decisions.forEach((decision, index) => {
      const decisionTable = decision.querySelector("decisionTable");
      if (!decisionTable) {
        errors.push(`Decision ${index + 1} has no decisionTable`);
        return;
      }

      // Check for inputs
      const inputs = decisionTable.querySelectorAll("input");
      if (inputs.length === 0) {
        errors.push(`Decision ${index + 1} decisionTable has no input columns`);
      }

      // Check for outputs
      const outputs = decisionTable.querySelectorAll("output");
      if (outputs.length === 0) {
        errors.push(`Decision ${index + 1} decisionTable has no output columns`);
      }

      // Check for rules
      const rules = decisionTable.querySelectorAll("rule");
      if (rules.length === 0) {
        errors.push(`Decision ${index + 1} decisionTable has no rules`);
      }

      // Validate rule structure
      rules.forEach((rule, ruleIndex) => {
        const inputEntries = rule.querySelectorAll("inputEntry");
        const outputEntries = rule.querySelectorAll("outputEntry");

        if (inputEntries.length !== inputs.length) {
          errors.push(
            `Decision ${index + 1}, Rule ${ruleIndex + 1}: inputEntry count (${inputEntries.length}) doesn't match input count (${inputs.length})`
          );
        }

        if (outputEntries.length !== outputs.length) {
          errors.push(
            `Decision ${index + 1}, Rule ${ruleIndex + 1}: outputEntry count (${outputEntries.length}) doesn't match output count (${outputs.length})`
          );
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : "Unknown error"}`);
    return { valid: false, errors };
  }
}

/**
 * Check if DMN decision table is complete
 */
export function isDecisionTableComplete(xmlString: string, decisionId: string): boolean {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "application/xml");

    const decision = doc.querySelector(`decision[id="${decisionId}"]`);
    if (!decision) return false;

    const decisionTable = decision.querySelector("decisionTable");
    if (!decisionTable) return false;

    const inputs = decisionTable.querySelectorAll("input");
    const outputs = decisionTable.querySelectorAll("output");
    const rules = decisionTable.querySelectorAll("rule");

    // Check that all rules have proper entries
    for (const rule of Array.from(rules)) {
      const inputEntries = rule.querySelectorAll("inputEntry");
      const outputEntries = rule.querySelectorAll("outputEntry");

      if (inputEntries.length !== inputs.length || outputEntries.length !== outputs.length) {
        return false;
      }
    }

    return inputs.length > 0 && outputs.length > 0 && rules.length > 0;
  } catch {
    return false;
  }
}

/**
 * Validate input/output definitions
 */
export function validateInputOutputDefinitions(xmlString: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "application/xml");

    // Check inputData elements
    const inputDataElements = doc.querySelectorAll("inputData");
    inputDataElements.forEach((inputData, index) => {
      const variable = inputData.querySelector("variable");
      if (!variable) {
        errors.push(`InputData ${index + 1} has no variable element`);
      } else {
        const typeRef = variable.getAttribute("typeRef");
        if (!typeRef) {
          errors.push(`InputData ${index + 1} variable has no typeRef`);
        }
      }
    });

    // Check decision outputs
    const decisions = doc.querySelectorAll("decision");
    decisions.forEach((decision, decisionIndex) => {
      const outputs = decision.querySelectorAll("output");
      outputs.forEach((output, outputIndex) => {
        const typeRef = output.getAttribute("typeRef");
        if (!typeRef) {
          errors.push(
            `Decision ${decisionIndex + 1}, Output ${outputIndex + 1} has no typeRef`
          );
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : "Unknown error"}`);
    return { valid: false, errors };
  }
}






