using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cliq.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddTerritoryWars : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TerritoryClaims",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CellRow = table.Column<long>(type: "bigint", nullable: false),
                    CellCol = table.Column<long>(type: "bigint", nullable: false),
                    Bucket = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ClaimedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Color = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    ClaimedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TerritoryClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TerritoryClaims_AspNetUsers_ClaimedByUserId",
                        column: x => x.ClaimedByUserId,
                        principalSchema: "public",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TerritoryPlayers",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Color = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    RegisteredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    LastClaimAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TerritoryPlayers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TerritoryPlayers_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalSchema: "public",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TerritoryClaims_Bucket",
                schema: "public",
                table: "TerritoryClaims",
                column: "Bucket");

            migrationBuilder.CreateIndex(
                name: "IX_TerritoryClaims_Bucket_CellRow_CellCol",
                schema: "public",
                table: "TerritoryClaims",
                columns: new[] { "Bucket", "CellRow", "CellCol" });

            migrationBuilder.CreateIndex(
                name: "IX_TerritoryClaims_CellRow_CellCol",
                schema: "public",
                table: "TerritoryClaims",
                columns: new[] { "CellRow", "CellCol" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TerritoryClaims_ClaimedByUserId",
                schema: "public",
                table: "TerritoryClaims",
                column: "ClaimedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_TerritoryPlayers_UserId",
                schema: "public",
                table: "TerritoryPlayers",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TerritoryClaims",
                schema: "public");

            migrationBuilder.DropTable(
                name: "TerritoryPlayers",
                schema: "public");
        }
    }
}
