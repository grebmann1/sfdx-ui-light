export const activate = async () => {
  console.warn(
    '[salesforce.salesforcedx-vscode-lightning] Browser wrapper loaded with grammar-only support. ' +
      'The Aura language server is still desktop-only in this repo.'
  );
};

export const deactivate = async () => {};
