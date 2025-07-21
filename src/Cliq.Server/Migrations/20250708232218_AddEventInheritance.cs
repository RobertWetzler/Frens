using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cliq.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddEventInheritance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "EndDateTime",
                schema: "public",
                table: "Posts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsAllDay",
                schema: "public",
                table: "Posts",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsRecurring",
                schema: "public",
                table: "Posts",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Location",
                schema: "public",
                table: "Posts",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MaxAttendees",
                schema: "public",
                table: "Posts",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PostType",
                schema: "public",
                table: "Posts",
                type: "character varying(5)",
                maxLength: 5,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "RecurrenceRule",
                schema: "public",
                table: "Posts",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "StartDateTime",
                schema: "public",
                table: "Posts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Timezone",
                schema: "public",
                table: "Posts",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true,
                defaultValue: "UTC");

            migrationBuilder.AddColumn<string>(
                name: "Title",
                schema: "public",
                table: "Posts",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "EventRsvps",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EventId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ResponseDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventRsvps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventRsvps_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalSchema: "public",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EventRsvps_Posts_EventId",
                        column: x => x.EventId,
                        principalSchema: "public",
                        principalTable: "Posts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EventRsvps_EventId_UserId",
                schema: "public",
                table: "EventRsvps",
                columns: new[] { "EventId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EventRsvps_UserId",
                schema: "public",
                table: "EventRsvps",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EventRsvps",
                schema: "public");

            migrationBuilder.DropColumn(
                name: "EndDateTime",
                schema: "public",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "IsAllDay",
                schema: "public",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "IsRecurring",
                schema: "public",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "Location",
                schema: "public",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "MaxAttendees",
                schema: "public",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "PostType",
                schema: "public",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "RecurrenceRule",
                schema: "public",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "StartDateTime",
                schema: "public",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "Timezone",
                schema: "public",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "Title",
                schema: "public",
                table: "Posts");
        }
    }
}
