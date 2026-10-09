"""Every language-dependent phrase the LinkedIn parser relies on, in one place.

LinkedIn sends these mails in the account's language (Turkish here). Template
detection does not depend on language (it uses LinkedIn's own page ids, see
``templates``), but card flags and section headers do. Supporting another
language means adding its phrases here, nothing else.
"""

import re

# Card lines that describe a posting rather than name it, mapped to flag codes.
FLAG_PHRASES = {
    "Özgeçmiş ve profil ile başvurun": "easy_apply",
    "Bu şirket aktif olarak işe alım yapıyor": "actively_hiring",
    "En önemli başvuranlar": "top_applicant",
    "Hızlı büyüyen": "fast_growing",
}
CONNECTIONS = re.compile(r"^(?P<count>\d+) bağlantı$")
ALUMNI = re.compile(r"^(?P<count>\d+) okul mezunu$")

# Section headers, per template.
ALERT_HEADER = re.compile(r"^(?P<query>.+?)\s+için iş ilanı uyarınız$")
# Digest section with postings from the owner's other alerts; its first line
# is followed by one highlight line that names a posting in HTML.
OTHER_ALERTS = re.compile(r"^Diğer uyarılarınızdan yeni iş ilanları$")
OTHER_ALERT_HIGHLIGHT = re.compile(r"^.+ konumunda <strong[^>]*>.+</strong> iş ilanı$")
# Seen variants: "yeni iş ilanları var.", "yeni bir iş ilanı var.",
# "11 yeni iş ilanı var."
ALERT_INTRO = re.compile(r"^Tercihlerinizle eşleşen .*iş ilan\w* var\.$")
CONFIRMATION_HEADER = re.compile(r"^Başvurunuz .+ şirketine gönderildi$")
APPLIED_ON = re.compile(
    r"^Başvuru tarihi: (?P<day>\d{1,2}) (?P<month>\w+) (?P<year>\d{4})"
)
NEXT_STEPS = re.compile(r"^Daha başarılı olmak için bu adımları atabilirsiniz$")
SIMILAR_TO_APPLIED = re.compile(r"^İlgilenebileceğiniz benzer iş ilanlarını inceleyin$")
VIEWED_HEADER = re.compile(
    r"^(?P<title>.+?) iş ilanına benzer iş ilanları "
    r"https://\S+/jobs/view/(?P<job_id>\d+)"
)
SAVED_HEADER = re.compile(r"^.+ şirketinden kaydettiğiniz iş ilanı hâlâ açık\.$")
APPLY_NOW = re.compile(r"^Hemen başvurun$")
OTHER_SAVED = re.compile(r"^Kaydedilen diğer iş ilanlarınız$")
# Contacts block in saved-job reminders: each contact (name, headline) ends
# with a "send message" link line, which is never card content.
CONTACTS_AT_COMPANY = re.compile(r"^.+ şirketinde bağlantılarınız var$")
ASK_ABOUT_JOB = re.compile(r"^İş ilanı hakkında soru sorun$")
SEND_MESSAGE = re.compile(r"^Mesaj gönder")
FACET_INTRO = re.compile(r"^(Aramanızı genişletin|Faaliyetlerinize göre öneriler\.)$")
FACET_SECTION = re.compile(r"^(?P<facet>.+) iş ilanları$")

# Application updates (HTML part): "2 Eyl tarihinde başvuruldu" (no year).
APPLIED_ON_SHORT = re.compile(r"^(?P<day>\d{1,2}) (?P<month>\w+) tarihinde başvuruldu$")

MONTHS = {
    "Ocak": 1,
    "Şubat": 2,
    "Mart": 3,
    "Nisan": 4,
    "Mayıs": 5,
    "Haziran": 6,
    "Temmuz": 7,
    "Ağustos": 8,
    "Eylül": 9,
    "Ekim": 10,
    "Kasım": 11,
    "Aralık": 12,
}

MONTH_ABBREVIATIONS = {
    "Oca": 1,
    "Şub": 2,
    "Mar": 3,
    "Nis": 4,
    "May": 5,
    "Haz": 6,
    "Tem": 7,
    "Ağu": 8,
    "Eyl": 9,
    "Eki": 10,
    "Kas": 11,
    "Ara": 12,
}
