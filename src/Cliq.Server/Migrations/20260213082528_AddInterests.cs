using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cliq.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddInterests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Interests",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Interests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Interests_AspNetUsers_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalSchema: "public",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "InterestAnnouncements",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    InterestId = table.Column<Guid>(type: "uuid", nullable: false),
                    AnnouncedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InterestAnnouncements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InterestAnnouncements_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalSchema: "public",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InterestAnnouncements_Interests_InterestId",
                        column: x => x.InterestId,
                        principalSchema: "public",
                        principalTable: "Interests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InterestPosts",
                schema: "public",
                columns: table => new
                {
                    InterestId = table.Column<Guid>(type: "uuid", nullable: false),
                    PostId = table.Column<Guid>(type: "uuid", nullable: false),
                    SharedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    WasAnnounced = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InterestPosts", x => new { x.InterestId, x.PostId });
                    table.ForeignKey(
                        name: "FK_InterestPosts_Interests_InterestId",
                        column: x => x.InterestId,
                        principalSchema: "public",
                        principalTable: "Interests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InterestPosts_Posts_PostId",
                        column: x => x.PostId,
                        principalSchema: "public",
                        principalTable: "Posts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InterestSubscriptions",
                schema: "public",
                columns: table => new
                {
                    InterestId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubscribedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    IncludeFriendsOfFriends = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InterestSubscriptions", x => new { x.InterestId, x.UserId });
                    table.ForeignKey(
                        name: "FK_InterestSubscriptions_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalSchema: "public",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InterestSubscriptions_Interests_InterestId",
                        column: x => x.InterestId,
                        principalSchema: "public",
                        principalTable: "Interests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_InterestAnnouncements_InterestId",
                schema: "public",
                table: "InterestAnnouncements",
                column: "InterestId");

            migrationBuilder.CreateIndex(
                name: "IX_InterestAnnouncements_UserId_AnnouncedAt",
                schema: "public",
                table: "InterestAnnouncements",
                columns: new[] { "UserId", "AnnouncedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_InterestAnnouncements_UserId_InterestId",
                schema: "public",
                table: "InterestAnnouncements",
                columns: new[] { "UserId", "InterestId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InterestPosts_InterestId",
                schema: "public",
                table: "InterestPosts",
                column: "InterestId");

            migrationBuilder.CreateIndex(
                name: "IX_InterestPosts_PostId",
                schema: "public",
                table: "InterestPosts",
                column: "PostId");

            migrationBuilder.CreateIndex(
                name: "IX_Interests_CreatedByUserId",
                schema: "public",
                table: "Interests",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Interests_Name",
                schema: "public",
                table: "Interests",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InterestSubscriptions_InterestId",
                schema: "public",
                table: "InterestSubscriptions",
                column: "InterestId");

            migrationBuilder.CreateIndex(
                name: "IX_InterestSubscriptions_UserId",
                schema: "public",
                table: "InterestSubscriptions",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InterestAnnouncements",
                schema: "public");

            migrationBuilder.DropTable(
                name: "InterestPosts",
                schema: "public");

            migrationBuilder.DropTable(
                name: "InterestSubscriptions",
                schema: "public");

            migrationBuilder.DropTable(
                name: "Interests",
                schema: "public");
        }
    }
}
