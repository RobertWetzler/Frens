using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cliq.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddPowerupClaims : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PowerupClaims",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CellRow = table.Column<long>(type: "bigint", nullable: false),
                    CellCol = table.Column<long>(type: "bigint", nullable: false),
                    PowerupType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    DateKey = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    ClaimedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PowerupClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PowerupClaims_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalSchema: "public",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PowerupClaims_CellRow_CellCol_DateKey",
                schema: "public",
                table: "PowerupClaims",
                columns: new[] { "CellRow", "CellCol", "DateKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PowerupClaims_UserId_UsedAt",
                schema: "public",
                table: "PowerupClaims",
                columns: new[] { "UserId", "UsedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PowerupClaims",
                schema: "public");
        }
    }
}
