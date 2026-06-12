// Custom login.ftl page — visual port of the TrackVision AI prototype login
// (app/src/pages-auth.jsx), wired to Keycloak via kcContext.
import { useState } from "react";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import { Icon } from "../components/Icon";
import { Labeled } from "../components/Labeled";
import { AuthLayout } from "../components/AuthLayout";

export default function Login(props: PageProps<Extract<KcContext, { pageId: "login.ftl" }>, I18n>) {
    const { kcContext } = props;
    const { url, realm, login, auth, messagesPerField, usernameHidden, message, registrationDisabled } = kcContext;

    const [isLoginButtonDisabled, setIsLoginButtonDisabled] = useState(false);

    const fieldError = messagesPerField.existsError("username", "password")
        ? kcSanitize(messagesPerField.getFirstError("username", "password"))
        : undefined;

    return (
        <AuthLayout
            mode="login"
            loginUrl={url.loginUrl}
            registrationUrl={realm.registrationAllowed && !registrationDisabled ? url.registrationUrl : undefined}
        >
            {realm.password && (
                <form
                    id="kc-form-login"
                    className="flex flex-col gap-5"
                    action={url.loginAction}
                    method="post"
                    onSubmit={() => {
                        setIsLoginButtonDisabled(true);
                        return true;
                    }}
                >
                    {/* global Keycloak message (e.g. session expired) */}
                    {message !== undefined && message.type === "error" && !messagesPerField.existsError("username", "password") && (
                        <div
                            className="text-[13px] leading-relaxed"
                            style={{
                                color: "oklch(0.72 0.18 25)",
                                background: "oklch(0.72 0.18 25 / 0.1)",
                                border: "1px solid oklch(0.72 0.18 25 / 0.3)",
                                borderRadius: 12,
                                padding: "12px 16px"
                            }}
                            aria-live="polite"
                            dangerouslySetInnerHTML={{ __html: kcSanitize(message.summary) }}
                        />
                    )}

                    {!usernameHidden && (
                        <Labeled label="Nombre o correo" error={fieldError}>
                            <input
                                tabIndex={2}
                                id="username"
                                name="username"
                                type="text"
                                defaultValue={login.username ?? ""}
                                autoFocus
                                autoComplete="username"
                                placeholder="usuario@trackvision.ai"
                                className="field"
                                aria-invalid={messagesPerField.existsError("username", "password")}
                            />
                        </Labeled>
                    )}

                    <Labeled label="Contraseña" error={usernameHidden ? fieldError : undefined}>
                        <input
                            tabIndex={3}
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            placeholder="••••••••"
                            className="field"
                            aria-invalid={messagesPerField.existsError("username", "password")}
                        />
                    </Labeled>

                    <input type="hidden" id="id-hidden-input" name="credentialId" value={auth.selectedCredential} />
                    <button
                        tabIndex={7}
                        disabled={isLoginButtonDisabled}
                        name="login"
                        id="kc-login"
                        type="submit"
                        className="btn-primary justify-center mt-1 text-[15px] py-3.5"
                    >
                        Entrar a la plataforma <Icon name="arrow" className="w-4 h-4" />
                    </button>
                </form>
            )}
        </AuthLayout>
    );
}
