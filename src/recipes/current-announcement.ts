import { AnnouncementPublish, PublishCredential, SmtpPublish } from "../model/operation.js"
import { ProfileId } from "../model/primitives.js"
import type { CandidateConfig } from "./config.js"
import { credentialName, operationId, type CurrentRows } from "./current-shared.js"
import { announcementHttpProfiles, smtpAnnouncementProfile } from "./announcement-profiles.js"
import { ConfigValueError } from "../model/errors.js"

export const lowerCurrentAnnouncements = (config: CandidateConfig, rows: CurrentRows): void => {
  const notes = rows.outputs.get("final-notes") ?? rows.outputs.get("release-notes")
  for (const action of config.publish.announce ?? []) {
    if (action.profileId === "announce.index/v1") continue
    if (action.profileId === "announce.smtp/v1") {
      if (notes === undefined) throw ConfigValueError.make({ reason: "Reviewed announcement notes are absent." })
      rows.announce.push(SmtpPublish.make({ id: operationId(`announce:${action.id}`),
        inputs: [notes.id], outputs: [], profileId: "announce.smtp/v1",
        target: { destination: action.destination },
        credential: PublishCredential.make({ name: credentialName(action.credentialEnv) }),
        contractFixtureId: smtpAnnouncementProfile.contractFixtureId })); continue
    }
    const profile = announcementHttpProfiles.find((item) => item.profileId === action.profileId)
    if (profile === undefined || notes === undefined)
      throw ConfigValueError.make({ reason: "Announcement profile or reviewed notes are absent." })
    rows.announce.push(AnnouncementPublish.make({
      id: operationId(`announce:${action.id}`), inputs: [notes.id], outputs: [],
      profileId: ProfileId.make(profile.profileId), target: { destination: action.destination },
      credential: PublishCredential.make({ name: credentialName(action.credentialEnv) }),
      contractFixtureId: profile.contractFixtureId }))
  } }
