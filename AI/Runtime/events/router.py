# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

class EventRouter:


    def route(self,event):

        handlers={

        "CHAT":
        self.chat,

        "VOICE":
        self.voice,

        "VISION":
        self.vision

        }


        handler=handlers.get(
        event
        )


        if handler:

            return handler()


        return "Unknown Event"



    def chat(self):

        return "Chat Handler"


    def voice(self):

        return "Voice Handler"


    def vision(self):

        return "Vision Handler"
