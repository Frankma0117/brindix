package com.brindix.common;

import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Correo transaccional por SMTP (Brevo: smtp-relay.brevo.com:587). Sin BRINDIX_MAIL_HOST no envía nada
 * (solo lo anota en el log). Se envía en segundo plano: la respuesta HTTP no espera al SMTP ni revela si salió.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final ObjectProvider<JavaMailSender> sender;
    private final AppProperties props;
    private final ExecutorService pool = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "brindix-mail");
        t.setDaemon(true);
        return t;
    });

    public MailService(ObjectProvider<JavaMailSender> sender, AppProperties props) {
        this.sender = sender;
        this.props = props;
    }

    public boolean enabled() {
        return props.mail() != null && props.mail().enabled() && sender.getIfAvailable() != null;
    }

    /** Correo del súper administrador para avisos de seguridad (BRINDIX_ADMIN_EMAIL). */
    public String adminEmail() {
        return props.mail() == null ? null : props.mail().adminEmail();
    }

    /**
     * Envía un correo con el diseño de Brindix.
     * @param lines párrafos en texto plano (se escapan)
     * @param code  código grande opcional (recuperación)
     */
    public void send(String to, String subject, String title, java.util.List<String> lines, String code, String buttonText, String buttonUrl) {
        if (to == null || to.isBlank()) return;
        if (!enabled()) {
            log.info("Correo sin enviar (falta BRINDIX_MAIL_HOST): «{}» para {}", subject, mask(to));
            return;
        }
        String html = html(title, lines, code, buttonText, buttonUrl);
        String text = title + "\n\n" + String.join("\n\n", lines) + (code != null ? "\n\nCódigo: " + code : "")
                + (buttonUrl != null ? "\n\n" + buttonText + ": " + buttonUrl : "") + "\n\n— Brindix";
        pool.submit(() -> {
            try {
                JavaMailSender s = sender.getObject();
                MimeMessage m = s.createMimeMessage();
                MimeMessageHelper h = new MimeMessageHelper(m, true, StandardCharsets.UTF_8.name());
                h.setFrom(new InternetAddress(props.mail().from(), props.mail().fromName(), StandardCharsets.UTF_8.name()));
                h.setTo(to.trim());
                h.setSubject(subject);
                h.setText(text, html);
                s.send(m);
                log.info("Correo enviado: «{}» para {}", subject, mask(to));
            } catch (Exception e) {
                log.warn("No se pudo enviar «{}» a {}: {}", subject, mask(to), e.getMessage());
            }
        });
    }

    private String html(String title, java.util.List<String> lines, String code, String buttonText, String buttonUrl) {
        StringBuilder p = new StringBuilder();
        for (String l : lines) p.append("<p style=\"margin:0 0 14px;font-size:15px;line-height:1.55;color:#3d3832\">").append(HtmlUtils.htmlEscape(l)).append("</p>");
        String codeBlock = code == null ? "" :
                "<div style=\"margin:22px 0;padding:18px;border-radius:12px;background:#15120f;color:#ffb238;font:800 30px/1 'Courier New',monospace;letter-spacing:6px;text-align:center\">"
                        + HtmlUtils.htmlEscape(code) + "</div>";
        String button = buttonUrl == null ? "" :
                "<p style=\"margin:22px 0 6px\"><a href=\"" + HtmlUtils.htmlEscape(buttonUrl) + "\" style=\"display:inline-block;padding:12px 20px;border-radius:10px;background:#ffb238;color:#1c0f08;font-weight:800;text-decoration:none\">"
                        + HtmlUtils.htmlEscape(buttonText) + "</a></p>";
        return "<!doctype html><html lang=\"es\"><body style=\"margin:0;background:#f3f3f1;font-family:Manrope,Segoe UI,Arial,sans-serif\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr><td align=\"center\" style=\"padding:28px 14px\">"
                + "<table role=\"presentation\" width=\"100%\" style=\"max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e7e6e2\"><tr><td style=\"padding:28px 28px 22px\">"
                + "<p style=\"margin:0 0 18px;font-weight:800;font-size:18px;color:#1a1714\">Brindix</p>"
                + "<h1 style=\"margin:0 0 16px;font-size:22px;line-height:1.25;color:#1a1714\">" + HtmlUtils.htmlEscape(title) + "</h1>"
                + p + codeBlock + button
                + "<p style=\"margin:22px 0 0;font-size:12.5px;line-height:1.5;color:#6e665e\">Si no fuiste tú, ignora este correo: tu contraseña no cambia mientras nadie use el código. Nunca te pediremos tu contraseña por correo.</p>"
                + "</td></tr></table></td></tr></table></body></html>";
    }

    private static String mask(String email) {
        int at = email.indexOf('@');
        return at <= 1 ? "***" : email.charAt(0) + "***" + email.substring(at);
    }
}
