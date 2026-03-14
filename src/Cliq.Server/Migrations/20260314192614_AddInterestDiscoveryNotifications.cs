using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cliq.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddInterestDiscoveryNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "DisableInterestDiscovery",
                schema: "public",
                table: "AspNetUsers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "InterestDiscoveryNotifications",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RecipientUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    InterestId = table.Column<Guid>(type: "uuid", nullable: false),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    FriendCount = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InterestDiscoveryNotifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InterestDiscoveryNotifications_AspNetUsers_RecipientUserId",
                        column: x => x.RecipientUserId,
                        principalSchema: "public",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InterestDiscoveryNotifications_Interests_InterestId",
                        column: x => x.InterestId,
                        principalSchema: "public",
                        principalTable: "Interests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_InterestDiscoveryNotifications_InterestId",
                schema: "public",
                table: "InterestDiscoveryNotifications",
                column: "InterestId");

            migrationBuilder.CreateIndex(
                name: "IX_InterestDiscoveryNotifications_RecipientUserId",
                schema: "public",
                table: "InterestDiscoveryNotifications",
                column: "RecipientUserId");

            migrationBuilder.CreateIndex(
                name: "IX_InterestDiscoveryNotifications_RecipientUserId_InterestId",
                schema: "public",
                table: "InterestDiscoveryNotifications",
                columns: new[] { "RecipientUserId", "InterestId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InterestDiscoveryNotifications",
                schema: "public");

            migrationBuilder.DropColumn(
                name: "DisableInterestDiscovery",
                schema: "public",
                table: "AspNetUsers");
        }
    }
}
