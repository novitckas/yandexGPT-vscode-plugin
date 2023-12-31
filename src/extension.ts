import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    const provider = new ColorsViewProvider(
        context.extensionUri,
        context.globalState
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ColorsViewProvider.viewType,
            provider
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'calicoColors.showMessageFromGpt',
            (resp) => {
                provider.showMessageFromGpt(resp);
            }
        )
    );
}

class ColorsViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'calicoColors.colorsView';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private globalState: vscode.ExtensionContext['globalState']
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,

            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'askUserForApiToken': {
                    const result = await vscode.window.showInputBox({
                        value: 'abcdef',
                        valueSelection: [2, 4],
                        placeHolder: 'For example: fedcba. But not: 123',
                        validateInput: (text) => {
                            vscode.window.showInformationMessage(
                                `Validating: ${text}`
                            );
                            return text === '123' ? 'Not 123!' : null;
                        },
                    });
                    await this.globalState.update('yandex-gpt-api-key', result);
                    vscode.window.showInformationMessage(`API token saved`);
                    break;
                }
                case 'sendMessage': {
                    fetch(
                        'https://d5dqa8btt79oqqp2j9hf.apigw.yandexcloud.net/gpt',
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(data.message),
                        }
                    )
                        .then((response) => response.json())
                        .then(({ result }) => {
                            vscode.commands.executeCommand(
                                'calicoColors.showMessageFromGpt',
                                result
                            );
                        });
                }
            }
        });
    }

    public showMessageFromGpt(resp: string) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'showMessageFromGpt',
                message: resp,
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')
        );

        // Do the same for the stylesheet.
        const styleResetUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')
        );
        const styleVSCodeUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css')
        );
        const styleMainUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css')
        );

        // Use a nonce to only allow a specific script to be run.
        const nonce = getNonce();

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
		

				<meta http-equiv="Content-Security-Policy" Content-Security-Policy: default-src "self"; connect-src "self" https://llm.api.cloud.yandex.net; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">

				<title>Cat Colors</title>
			</head>
			<body>
				<ul class="color-list">
				</ul>
				<div id="response-box" class="chat-box"></div>
				<textarea id="input" rows="5" cols="33"></textarea>

				<button class="add-color-button">Send</button>
				<button id="set-api-token" class="add-color-button">Set API token</button>

                <script nonce="${nonce}" src="${scriptUri}"></script>


			</body>
			</html>`;
    }
}

function getNonce() {
    let text = '';
    const possible =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
