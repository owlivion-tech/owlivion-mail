cask "owlivion-mail" do
  version "1.0.0"
  sha256 "REPLACE_WITH_ACTUAL_SHA256"

  url "https://github.com/babafpv/owlivion-mail/releases/download/v#{version}/Owlivion.Mail_#{version}_universal.dmg",
      verified: "github.com/babafpv/owlivion-mail/"
  name "Owlivion Mail"
  desc "Privacy-first desktop email client with AI phishing detection"
  homepage "https://owlivion.com/mail/"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true
  depends_on macos: ">= :big_sur"

  app "Owlivion Mail.app"

  zap trash: [
    "~/Library/Application Support/com.owlivion.mail",
    "~/Library/Caches/com.owlivion.mail",
    "~/Library/Preferences/com.owlivion.mail.plist",
    "~/Library/Saved Application State/com.owlivion.mail.savedState",
  ]
end
