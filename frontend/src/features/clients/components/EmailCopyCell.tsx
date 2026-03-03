import React, { useState, useCallback } from "react";

interface EmailCopyCellProps {
   email: string;
}

const EmailCopyCell: React.FC<EmailCopyCellProps> = ({ email }) => {
   const [copied, setCopied] = useState(false);

   const handleCopy = useCallback(
      async (e: React.MouseEvent) => {
         e.preventDefault();
         e.stopPropagation(); // Prevents triggering row selection/clicks

         try {
            await navigator.clipboard.writeText(email);
            setCopied(true);

            // Reset the "Copied" state after 2 seconds
            setTimeout(() => setCopied(false), 2000);
         } catch (err) {
            console.error("Failed to copy email: ", err);
         }
      },
      [email],
   );

   return (
      <div style={{ position: "relative", display: "inline-block" }}>
         <button
            onClick={handleCopy}
            style={{
               background: "none",
               border: "none",
               padding: 0,
               color: "#2563eb", // Standard link blue
               textDecoration: "underline",
               cursor: "pointer",
               font: "inherit",
            }}>
            {email}
         </button>

         {copied && (
            <div
               style={{
                  position: "absolute",
                  bottom: "120%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: "#1f2937",
                  color: "white",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  whiteSpace: "nowrap",
                  zIndex: 10,
                  pointerEvents: "none", // Ensures it doesn't block mouse clicks
               }}>
               Copied!
               {/* Small tooltip arrow */}
               <div
                  style={{
                     position: "absolute",
                     top: "100%",
                     left: "50%",
                     transform: "translateX(-50%)",
                     borderWidth: "5px",
                     borderStyle: "solid",
                     borderColor: "#1f2937 transparent transparent transparent",
                  }}
               />
            </div>
         )}
      </div>
   );
};

export default EmailCopyCell;
