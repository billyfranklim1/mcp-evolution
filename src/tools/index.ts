import type { ToolRegistry } from "../registry.js";
import { registerListInstances } from "./list-instances.js";

// Original tools
import { registerListGroups } from "./list-groups.js";
import { registerFindChats } from "./find-chats.js";
import { registerFindContacts } from "./find-contacts.js";
import { registerFindMessages } from "./find-messages.js";
import { registerGetChatHistory } from "./get-chat-history.js";
import { registerSendText } from "./send-text.js";
import { registerSendMedia } from "./send-media.js";
import { registerGetGroupInfo } from "./get-group-info.js";
import { registerGetGroupResolvedParticipants } from "./get-group-resolved-participants.js";

// Message
import { registerSendAudio } from "./send-audio.js";
import { registerSendSticker } from "./send-sticker.js";
import { registerSendLocation } from "./send-location.js";
import { registerSendContact } from "./send-contact.js";
import { registerSendReaction } from "./send-reaction.js";
import { registerSendPoll } from "./send-poll.js";
import { registerSendList } from "./send-list.js";
import { registerSendButton } from "./send-button.js";
import { registerSendStatus } from "./send-status.js";

// Chat
import { registerMarkAsRead } from "./mark-as-read.js";
import { registerArchiveChat } from "./archive-chat.js";
import { registerDeleteMessage } from "./delete-message.js";
import { registerFetchProfilePicture } from "./fetch-profile-picture.js";
import { registerDownloadMedia } from "./download-media.js";
import { registerSendPresence } from "./send-presence.js";

// Profile
import { registerFetchBusinessProfile } from "./fetch-business-profile.js";
import { registerUpdateProfileName } from "./update-profile-name.js";
import { registerUpdateProfileStatus } from "./update-profile-status.js";
import { registerUpdateProfilePicture } from "./update-profile-picture.js";
import { registerRemoveProfilePicture } from "./remove-profile-picture.js";
import { registerFetchPrivacy } from "./fetch-privacy.js";
import { registerUpdatePrivacy } from "./update-privacy.js";

// Group
import { registerCreateGroup } from "./create-group.js";
import { registerUpdateGroupSubject } from "./update-group-subject.js";
import { registerUpdateGroupDescription } from "./update-group-description.js";
import { registerUpdateGroupPicture } from "./update-group-picture.js";
import { registerFetchInviteCode } from "./fetch-invite-code.js";
import { registerRevokeInviteCode } from "./revoke-invite-code.js";
import { registerAcceptInvite } from "./accept-invite.js";
import { registerSendGroupInvite } from "./send-group-invite.js";
import { registerUpdateParticipants } from "./update-participants.js";
import { registerUpdateGroupSetting } from "./update-group-setting.js";
import { registerLeaveGroup } from "./leave-group.js";
import { registerFindGroupByInvite } from "./find-group-by-invite.js";

// Instance
import { registerConnectionState } from "./connection-state.js";
import { registerRestartInstance } from "./restart-instance.js";
import { registerLogoutInstance } from "./logout-instance.js";
import { registerGetSettings } from "./get-settings.js";
import { registerSetSettings } from "./set-settings.js";

// Webhook
import { registerFindWebhook } from "./find-webhook.js";
import { registerSetWebhook } from "./set-webhook.js";

// Label
import { registerFindLabels } from "./find-labels.js";
import { registerHandleLabel } from "./handle-label.js";

// Block & Misc
import { registerUpdateBlockStatus } from "./update-block-status.js";
import { registerCheckNumber } from "./check-number.js";

export function registerAllTools(server: ToolRegistry): void {
  registerListInstances(server);

  // Original
  registerListGroups(server);
  registerFindChats(server);
  registerFindContacts(server);
  registerFindMessages(server);
  registerGetChatHistory(server);
  registerSendText(server);
  registerSendMedia(server);
  registerGetGroupInfo(server);
  registerGetGroupResolvedParticipants(server);

  // Message
  registerSendAudio(server);
  registerSendSticker(server);
  registerSendLocation(server);
  registerSendContact(server);
  registerSendReaction(server);
  registerSendPoll(server);
  registerSendList(server);
  registerSendButton(server);
  registerSendStatus(server);

  // Chat
  registerMarkAsRead(server);
  registerArchiveChat(server);
  registerDeleteMessage(server);
  registerFetchProfilePicture(server);
  registerDownloadMedia(server);
  registerSendPresence(server);

  // Profile
  registerFetchBusinessProfile(server);
  registerUpdateProfileName(server);
  registerUpdateProfileStatus(server);
  registerUpdateProfilePicture(server);
  registerRemoveProfilePicture(server);
  registerFetchPrivacy(server);
  registerUpdatePrivacy(server);

  // Group
  registerCreateGroup(server);
  registerUpdateGroupSubject(server);
  registerUpdateGroupDescription(server);
  registerUpdateGroupPicture(server);
  registerFetchInviteCode(server);
  registerRevokeInviteCode(server);
  registerAcceptInvite(server);
  registerSendGroupInvite(server);
  registerUpdateParticipants(server);
  registerUpdateGroupSetting(server);
  registerLeaveGroup(server);
  registerFindGroupByInvite(server);

  // Instance
  registerConnectionState(server);
  registerRestartInstance(server);
  registerLogoutInstance(server);
  registerGetSettings(server);
  registerSetSettings(server);

  // Webhook
  registerFindWebhook(server);
  registerSetWebhook(server);

  // Label
  registerFindLabels(server);
  registerHandleLabel(server);

  // Block & Misc
  registerUpdateBlockStatus(server);
  registerCheckNumber(server);
}
