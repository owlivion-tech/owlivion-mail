//! Test autoconfig debug functionality

use owlivion_mail_lib::mail::fetch_autoconfig_debug;

#[tokio::main]
async fn main() {
    env_logger::init();

    let test_emails = vec![
        "test@gmail.com",
        "test@outlook.com",
        "test@yandex.com",
        "test@unknowndomain99999.xyz",
    ];

    for email in test_emails {
        println!("\n{}", "=".repeat(60));
        println!("Testing: {}", email);
        println!("{}", "=".repeat(60));

        match fetch_autoconfig_debug(email).await {
            Ok(debug) => {
                println!("✓ Domain: {}", debug.domain);
                println!("✓ Total Duration: {}ms", debug.total_duration_ms);
                println!();

                print_step("1. Preset", debug.preset_tried, &debug.preset_result);
                print_step("2. ISP Autoconfig", debug.isp_autoconfig_tried, &debug.isp_autoconfig_result);
                print_step("3. Well-known", debug.wellknown_tried, &debug.wellknown_result);
                print_step("4. Mozilla ISPDB", debug.ispdb_tried, &debug.ispdb_result);
                print_step("5. MX Lookup", debug.mx_lookup_tried, &debug.mx_lookup_result);
                print_step("6. Smart Guessing", debug.guessing_tried, &debug.guessing_result);

                if let Some(config) = debug.final_config {
                    println!();
                    println!("Final Config:");
                    println!("  Provider: {:?}", config.provider);
                    println!("  Method: {:?}", config.detection_method);
                    println!("  IMAP: {}:{} ({})", config.imap_host, config.imap_port, format!("{:?}", config.imap_security));
                    println!("  SMTP: {}:{} ({})", config.smtp_host, config.smtp_port, format!("{:?}", config.smtp_security));
                }
            }
            Err(e) => {
                println!("✗ Error: {}", e);
            }
        }
    }
}

fn print_step(name: &str, tried: bool, result: &Option<String>) {
    if !tried {
        println!("⏭ {}: Skipped", name);
        return;
    }

    match result.as_deref() {
        Some("SUCCESS") => println!("✅ {}: SUCCESS", name),
        Some("NOT_FOUND") => println!("⚠️  {}: NOT_FOUND", name),
        Some(err) => println!("❌ {}: {}", name, err),
        None => println!("⏭ {}: Skipped", name),
    }
}
