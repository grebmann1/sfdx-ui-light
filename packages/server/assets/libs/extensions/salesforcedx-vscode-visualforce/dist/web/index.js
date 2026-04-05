export const activate = async () => {
  console.warn(
    '[salesforce.salesforcedx-vscode-visualforce] Browser wrapper loaded with grammar-only support. ' +
      'The Visualforce language server is still desktop-only in this repo.'
  );
};

export const deactivate = async () => {};
